import "client-only";
import {
  BrowserProvider,
  type Eip1193Provider,
  type JsonRpcSigner,
} from "ethers";
import { CHAIN_ID, CHAIN_PARAMS } from "@/lib/shared/chain";
import { api } from "./api";
import type { SessionUser } from "@/lib/shared/auth";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export class WalletNotFoundError extends Error {
  constructor() {
    super("No se encontró MetaMask. Instálalo para continuar.");
  }
}

const UNRECOGNIZED_CHAIN = 4902;

async function ensureMonadTestnet(ethereum: Eip1193Provider): Promise<void> {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_PARAMS.chainId }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== UNRECOGNIZED_CHAIN) throw error;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [CHAIN_PARAMS],
    });
  }
}

export async function connectWallet(
  options: { linking?: boolean } = {},
): Promise<{
  signer: JsonRpcSigner;
  address: string;
}> {
  const { user } = await api<{ user: SessionUser }>("/api/auth/me");
  if (!user)
    throw new Error(
      "Inicia sesión con Google o GitHub antes de conectar MetaMask.",
    );
  if (!options.linking && !user.wallet)
    throw new Error(
      "Vincula tu wallet a tu cuenta antes de realizar transacciones.",
    );
  const ethereum = window.ethereum;
  if (!ethereum) throw new WalletNotFoundError();

  await ethereum.request({ method: "eth_requestAccounts" });
  await ensureMonadTestnet(ethereum);

  const provider = new BrowserProvider(ethereum, CHAIN_ID);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  if (user.wallet && user.wallet.toLowerCase() !== address.toLowerCase()) {
    throw new Error(
      "Selecciona en MetaMask la wallet vinculada a tu cuenta de PACT.",
    );
  }
  return { signer, address };
}
