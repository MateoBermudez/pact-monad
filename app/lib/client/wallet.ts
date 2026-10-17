import "client-only";
import {
  BrowserProvider,
  type Eip1193Provider,
  type JsonRpcSigner,
} from "ethers";
import { CHAIN_ID, CHAIN_PARAMS } from "@/lib/shared/chain";

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

export async function connectWallet(): Promise<{
  signer: JsonRpcSigner;
  address: string;
}> {
  const ethereum = window.ethereum;
  if (!ethereum) throw new WalletNotFoundError();

  await ethereum.request({ method: "eth_requestAccounts" });
  await ensureMonadTestnet(ethereum);

  const provider = new BrowserProvider(ethereum, CHAIN_ID);
  const signer = await provider.getSigner();
  return { signer, address: await signer.getAddress() };
}
