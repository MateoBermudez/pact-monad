import "client-only";
import { isAddress, parseEther, ZeroAddress, JsonRpcProvider } from "ethers";
import { RPC_URL, CHAIN_ID } from "@/lib/shared/chain";
import { escrowContract } from "./escrow-wallet";
import type { CreateAgreementParams } from "@/lib/shared/listings";
export async function fundSelectedAgreement(
  params: CreateAgreementParams,
  onSent: (hash: string) => void,
): Promise<string> {
  if (
    !isAddress(params.provider) ||
    params.provider === ZeroAddress ||
    !/^0x[0-9a-f]{64}$/i.test(params.rulesHash) ||
    !Number.isInteger(params.deadlineDays) ||
    params.deadlineDays < 1 ||
    params.deadlineDays > 365 ||
    parseEther(params.amountMon) <= BigInt(0)
  )
    throw new Error(
      "Revisa las condiciones y la wallet del proveedor antes de continuar.",
    );
  const contract = await escrowContract();
  const tx = await contract.getFunction("createAgreement")(
    params.provider,
    params.description,
    Math.floor(Date.now() / 1000) + params.deadlineDays * 86400,
    params.rulesHash,
    { value: parseEther(params.amountMon) },
  );
  onSent(String(tx.hash));
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1)
    throw new Error(
      "La transacción no se confirmó. Consulta el explorer antes de reintentar.",
    );
  return String(receipt.hash);
}
export async function fundingTransactionState(
  hash: string,
): Promise<"pending" | "failed" | "confirmed"> {
  if (!/^0x[0-9a-f]{64}$/i.test(hash))
    throw new Error("Hash de transacción inválido.");
  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID);
  try {
    const receipt = await provider.getTransactionReceipt(hash);
    return !receipt ? "pending" : receipt.status === 1 ? "confirmed" : "failed";
  } finally {
    provider.destroy();
  }
}
