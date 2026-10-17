import "client-only";
import {
  Contract,
  Interface,
  isAddress,
  parseEther,
  ZeroAddress,
  type ContractTransactionResponse,
} from "ethers";
import abi from "@/abi/PactEscrow.json";
import { connectWallet } from "./wallet";
import { CHAIN_ID, CHAIN_PARAMS, CONTRACT_ADDRESS } from "@/lib/shared/chain";
import { api, jsonRequest } from "./api";
import { ensureSession } from "./auth";
import type { PreparedAgreement } from "@/lib/shared/direct-agreement";

export const MONAD_CHAIN_ID = CHAIN_ID;
export const getEthereum = () =>
  typeof window === "undefined" ? undefined : window.ethereum;
export class WalletNotFoundError extends Error {
  constructor() {
    super("No se encontró MetaMask. Instálalo para continuar.");
  }
}
export function isUserRejectedError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === 4001 || code === "ACTION_REJECTED";
}
export async function getChainId(): Promise<number | null> {
  const eth = getEthereum();
  return eth ? Number(await eth.request({ method: "eth_chainId" })) : null;
}
export async function switchToMonadTestnet() {
  const eth = getEthereum();
  if (!eth) throw new WalletNotFoundError();
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_PARAMS.chainId }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [CHAIN_PARAMS],
    });
  }
}
export async function getWalletBalanceMon(address: string): Promise<number> {
  const eth = getEthereum();
  if (!eth) return 0;
  return (
    Number(
      BigInt(
        (await eth.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        })) as string,
      ),
    ) / 1e18
  );
}
export async function connectMetaMask() {
  const { address } = await connectWallet();
  return {
    address,
    chainId: CHAIN_ID,
    balance: await getWalletBalanceMon(address),
  };
}
// Reconecta en silencio, sin ventanas de MetaMask: solo si la wallet de la cuenta ya está autorizada para este sitio.
export async function restoreWallet(
  expected: string,
): Promise<{ address: string; chainId: number; balance: number } | null> {
  const eth = getEthereum();
  if (!eth) return null;
  const accounts = (await eth.request({ method: "eth_accounts" })) as unknown;
  const account = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof account !== "string" || account.toLowerCase() !== expected.toLowerCase()) return null;
  return {
    address: account,
    chainId: Number(await eth.request({ method: "eth_chainId" })),
    balance: await getWalletBalanceMon(account),
  };
}
export async function escrowContract() {
  if (!isAddress(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === ZeroAddress)
    throw new Error(
      "Configura NEXT_PUBLIC_CONTRACT_ADDRESS en app/.env.local antes de enviar transacciones.",
    );
  const { signer } = await connectWallet();
  if ((await signer.provider.getCode(CONTRACT_ADDRESS)) === "0x") {
    throw new Error(
      "La dirección configurada no contiene un contrato en esta red.",
    );
  }
  return new Contract(CONTRACT_ADDRESS, abi, signer);
}
export async function sendEscrowAction(
  method:
    | "acceptAgreement"
    | "registerDelivery"
    | "approveAndRelease"
    | "cancelAndRefund"
    | "setAutoReleaseLimit",
  args: readonly unknown[],
  expectedContract?: string,
): Promise<string> {
  if (
    expectedContract &&
    expectedContract.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()
  ) {
    throw new Error(
      "Este acuerdo pertenece a otro contrato. Cambia la configuración antes de operar.",
    );
  }
  const contract = await escrowContract();
  const transaction = (await contract.getFunction(method)(
    ...args,
  )) as ContractTransactionResponse;
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1)
    throw new Error("La transacción no se confirmó correctamente.");
  return receipt.hash;
}
export async function createAndLockAgreement({
  clientAddress,
  providerAddress,
  description,
  amountMon,
  days,
  title,
  listingId,
  onPrepared,
  onTxSent,
}: {
  clientAddress: string;
  providerAddress: string;
  description: string;
  amountMon: number;
  days: number;
  title: string;
  listingId?: string;
  onPrepared: (id: string) => void;
  onTxSent: (hash?: string) => void;
}): Promise<{ txHash: string; chainAgreementId: string }> {
  if (
    !isAddress(providerAddress) ||
    providerAddress === ZeroAddress ||
    providerAddress.toLowerCase() === clientAddress.toLowerCase()
  )
    throw new Error("Revisa la wallet del proveedor.");
  const contract = await escrowContract();
  const currentClient = await (
    contract.runner as Awaited<ReturnType<typeof connectWallet>>["signer"]
  ).getAddress();
  if (currentClient.toLowerCase() !== clientAddress.toLowerCase())
    throw new Error("La cuenta cambió. Revisa la wallet antes de confirmar.");
  await ensureSession();
  const { agreement } = await api<{ agreement: PreparedAgreement }>(
    "/api/agreements/prepare",
    jsonRequest("POST", {
      listingId,
      title,
      description,
      amountMon,
      days,
      provider: providerAddress,
    }),
  );
  onPrepared(agreement.listingId);
  const deadline = Math.floor(Date.now() / 1000) + days * 86400;
  const tx = (await contract.getFunction("createAgreement")(
    agreement.provider,
    agreement.description,
    deadline,
    agreement.rulesHash,
    { value: parseEther(agreement.amountMon) },
  )) as ContractTransactionResponse;
  onTxSent(tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1)
    throw new Error("La transacción fue revertida.");
  const iface = new Interface(abi);
  for (const log of receipt.logs) {
    try {
      const event = iface.parseLog(log);
      if (event?.name === "AgreementCreated")
        return {
          txHash: receipt.hash,
          chainAgreementId: String(event.args[0]),
        };
    } catch {
      /* Another event. */
    }
  }
  throw new Error(
    "La transacción se confirmó, pero no se encontró el evento de creación. Consulta el explorer antes de reintentar.",
  );
}
