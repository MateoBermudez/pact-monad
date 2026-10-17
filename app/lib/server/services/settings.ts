import "server-only";
import { formatEther } from "ethers";
import { agentAddress, configuredContractAddress, readMaxAutoRelease } from "@/lib/server/chain/contract";
import { query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { trimMon } from "@/lib/shared/money";

export type AiSettingsDto = {
  enabled: boolean;
  limitMon: string;
  capMon: string | null;
  agentAddress: string | null;
  contractAddress: string | null;
};

let cachedCap: bigint | null = null;

async function capWei(): Promise<bigint | null> {
  if (!configuredContractAddress()) return null;
  cachedCap ??= await readMaxAutoRelease();
  return cachedCap;
}

// El límite real vive en el contrato; esta tabla es un espejo que mantiene el indexador.
// Para cambiarlo, el cliente firma setAutoReleaseLimit desde su wallet.
export async function loadAiSettings(userId: string): Promise<AiSettingsDto> {
  const [row] = await query<{ auto_release: boolean; limit_mon: string }>(
    "select auto_release, auto_release_limit_mon::text as limit_mon from ai_settings where user_id = $1",
    [userId],
  );
  const cap = await capWei();
  return {
    enabled: row?.auto_release ?? false,
    limitMon: trimMon(row?.limit_mon ?? "0"),
    capMon: cap === null ? null : trimMon(formatEther(cap)),
    agentAddress: serverEnv.agentPrivateKey ? agentAddress() : null,
    contractAddress: configuredContractAddress(),
  };
}
