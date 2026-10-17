import "server-only";
import { Contract, Interface, isAddress, Wallet, type InterfaceAbi } from "ethers";
import abi from "@/abi/PactEscrow.json";
import { getProvider } from "@/lib/server/chain/provider";
import { withTransaction } from "@/lib/server/db";
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

// Identificador del candado de la base que serializa los envíos del agente.
const AGENT_TX_LOCK = 7_240_001;

// El agente firma siempre con la misma wallet, y dos transacciones simultáneas reutilizarían el nonce. Con varias
// instancias (Vercel) una cola en memoria no basta: el candado de la base las serializa entre procesos. Es de tipo
// "de transacción", así que se suelta solo al terminar o si algo falla, y funciona con el pooler de Supabase.
export function releaseByAgent(chainAgreementId: bigint, decisionHash: string): Promise<string> {
  if (!serverEnv.agentPrivateKey) {
    return Promise.reject(new ApiError(503, "agent_not_configured", "El agente de IA no está configurado"));
  }
  return withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock($1)", [AGENT_TX_LOCK]);
    const signer = new Wallet(serverEnv.agentPrivateKey, getProvider());
    const contract = new Contract(contractAddress(), pactInterface, signer);
    const tx = await contract.releaseByAgent(chainAgreementId, decisionHash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("La transacción del agente falló");
    return receipt.hash as string;
  });
}
