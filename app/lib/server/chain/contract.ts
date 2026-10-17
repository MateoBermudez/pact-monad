import "server-only";
import { Contract, Interface, isAddress, Wallet, type InterfaceAbi } from "ethers";
import abi from "@/abi/PactEscrow.json";
import { getProvider } from "@/lib/server/chain/provider";
import { serverEnv } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { CONTRACT_ADDRESS } from "@/lib/shared/chain";

export const pactInterface = new Interface(abi as InterfaceAbi);

export function configuredContractAddress(): string | null {
  return isAddress(CONTRACT_ADDRESS) ? CONTRACT_ADDRESS.toLowerCase() : null;
}

export function contractAddress(): string {
  const address = configuredContractAddress();
  if (!address) throw new ApiError(503, "contract_not_configured", "El contrato aún no está desplegado");
  return address;
}

export function readContract(): Contract {
  return new Contract(contractAddress(), pactInterface, getProvider());
}

export function agentAddress(): string {
  if (!serverEnv.agentPrivateKey) throw new ApiError(503, "agent_not_configured", "El agente de IA no está configurado");
  return new Wallet(serverEnv.agentPrivateKey).address.toLowerCase();
}

export async function readAutoReleaseLimit(client: string): Promise<bigint> {
  const limit: unknown = await readContract().autoReleaseLimit(client);
  if (typeof limit !== "bigint") throw new Error("Respuesta inválida de autoReleaseLimit");
  return limit;
}

export async function readMaxAutoRelease(): Promise<bigint> {
  const cap: unknown = await readContract().maxAutoRelease();
  if (typeof cap !== "bigint") throw new Error("Respuesta inválida de maxAutoRelease");
  return cap;
}

// Las transacciones del agente se encolan para no reutilizar nonce cuando llegan varias liberaciones a la vez.
let agentQueue: Promise<unknown> = Promise.resolve();

export function releaseByAgent(chainAgreementId: bigint, decisionHash: string): Promise<string> {
  const run = agentQueue.then(async () => {
    if (!serverEnv.agentPrivateKey) throw new ApiError(503, "agent_not_configured", "El agente de IA no está configurado");
    const signer = new Wallet(serverEnv.agentPrivateKey, getProvider());
    const contract = new Contract(contractAddress(), pactInterface, signer);
    const tx = await contract.releaseByAgent(chainAgreementId, decisionHash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("La transacción del agente falló");
    return receipt.hash as string;
  });
  agentQueue = run.catch(() => undefined);
  return run;
}
