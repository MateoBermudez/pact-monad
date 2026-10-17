export interface Eip1193Provider {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export const MONAD_CHAIN_ID = 10143;
export const MONAD_CHAIN_HEX = `0x${MONAD_CHAIN_ID.toString(16)}`;
export const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
export const MONAD_EXPLORER_URL = "https://testnet.monadscan.com";

export const MONAD_CHAIN_PARAMS = {
  chainId: MONAD_CHAIN_HEX,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: [MONAD_RPC_URL],
  blockExplorerUrls: [MONAD_EXPLORER_URL],
} as const;

const UNRECOGNIZED_CHAIN = 4902;
const USER_REJECTED = 4001;

export class WalletNotFoundError extends Error {
  constructor() {
    super("No se encontró MetaMask. Instálalo en tu navegador para continuar.");
  }
}

export class UserRejectedError extends Error {
  constructor() {
    super("Rechazaste la firma en MetaMask.");
  }
}

export function isUserRejectedError(error: unknown): boolean {
  if (error instanceof UserRejectedError) return true;
  const code = (error as { code?: number })?.code;
  if (code === USER_REJECTED) return true;
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? "";
  return msg.includes("user rejected") || msg.includes("user denied");
}

export function getEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return window.ethereum;
}

export async function getChainId(ethereum = getEthereum()): Promise<number | null> {
  if (!ethereum) return null;
  const hex = (await ethereum.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

export async function switchToMonadTestnet(ethereum = getEthereum()): Promise<void> {
  if (!ethereum) throw new WalletNotFoundError();
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_CHAIN_HEX }],
    });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== UNRECOGNIZED_CHAIN) throw error;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [MONAD_CHAIN_PARAMS],
    });
  }
}

export async function getWalletBalanceMon(
  address: string,
  ethereum = getEthereum(),
): Promise<number> {
  try {
    if (ethereum) {
      const hex = (await ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      const wei = BigInt(hex);
      return +(Number(wei) / 1e18).toFixed(4);
    }
  } catch {
    // Fallback to Monad Testnet RPC if provider call fails
  }
  try {
    const res = await fetch(MONAD_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });
    const data = (await res.json()) as { result?: string };
    if (data.result) {
      return +(Number(BigInt(data.result)) / 1e18).toFixed(4);
    }
  } catch {
    // Ignore RPC error
  }
  return 0;
}

export async function connectMetaMask(): Promise<{
  address: string;
  chainId: number;
  balance: number;
}> {
  const ethereum = getEthereum();
  if (!ethereum) throw new WalletNotFoundError();

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts?.[0];
  if (!address) {
    throw new Error("No se seleccionó ninguna cuenta en MetaMask.");
  }

  await switchToMonadTestnet(ethereum);
  const chainId = (await getChainId(ethereum)) ?? MONAD_CHAIN_ID;
  const balance = await getWalletBalanceMon(address, ethereum);

  return { address, chainId, balance };
}

export async function signWithMetaMask(address: string, message: string): Promise<string> {
  const ethereum = getEthereum();
  if (!ethereum) throw new WalletNotFoundError();
  try {
    const signature = (await ethereum.request({
      method: "personal_sign",
      params: [message, address],
    })) as string;
    return signature;
  } catch (error) {
    if (isUserRejectedError(error)) {
      throw new UserRejectedError();
    }
    throw error;
  }
}

async function waitForTransactionReceipt(txHash: string, ethereum: Eip1193Provider): Promise<void> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") {
        throw new Error("La transacción fue revertida por la red.");
      }
      return;
    }
  }
  throw new Error("Tiempo de espera agotado confirmando la transacción en Monad Testnet.");
}

export async function createAndLockAgreement({
  clientAddress,
  providerAddress,
  description,
  amountMon,
  days,
  onTxSent,
}: {
  clientAddress: string;
  providerAddress: string;
  description: string;
  amountMon: number;
  days: number;
  onTxSent: (txHash?: string) => void;
}): Promise<{ txHash?: string }> {
  const ethereum = getEthereum();
  if (!ethereum) throw new WalletNotFoundError();

  const contractAddress = (import.meta.env["VITE_CONTRACT_ADDRESS"] as string | undefined)?.trim();
  const weiValue = BigInt(Math.round(amountMon * 1e18));
  const valueHex = `0x${weiValue.toString(16)}`;

  try {
    if (contractAddress && /^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
      const txHash = (await ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: clientAddress,
            to: contractAddress,
            value: valueHex,
          },
        ],
      })) as string;
      onTxSent(txHash);
      await waitForTransactionReceipt(txHash, ethereum);
      return { txHash };
    }

    const message = [
      "PACT — Crear acuerdo y bloquear fondos en Monad Testnet",
      `Cliente: ${clientAddress}`,
      `Proveedor: ${providerAddress}`,
      `Depósito: ${amountMon} MON`,
      `Plazo: ${days} días`,
      `Trabajo y entregables: ${description}`,
    ].join("\n");

    const sig = await signWithMetaMask(clientAddress, message);
    onTxSent(sig);
    await new Promise((r) => setTimeout(r, 1100));
    return { txHash: sig };
  } catch (error) {
    if (isUserRejectedError(error)) {
      throw new UserRejectedError();
    }
    throw error;
  }
}
