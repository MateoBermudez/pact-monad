import "server-only";
import { formatEther } from "ethers";
import { agentAddress, configuredContractAddress, readMaxAutoRelease } from "@/lib/server/chain/contract";
import { query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { trimMon } from "@/lib/shared/money";
import type { ScreeningMode } from "@/lib/shared/listings";
import { DEFAULT_SCREENING_MODE, type ScreeningSettingsDto, type ScreeningSettingsInput } from "@/lib/shared/schemas";

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

export async function loadScreeningSettings(userId: string): Promise<ScreeningSettingsDto> {
  const [row] = await query<{ mode: ScreeningMode; criteria: string | null }>(
    "select screening_mode as mode, screening_criteria as criteria from ai_settings where user_id = $1",
    [userId],
  );
  return { mode: row?.mode ?? DEFAULT_SCREENING_MODE, criteria: row?.criteria ?? "" };
}

export async function saveScreeningSettings(userId: string, input: ScreeningSettingsInput): Promise<ScreeningSettingsDto> {
  await query(
    `insert into ai_settings (user_id, screening_mode, screening_criteria) values ($1, $2, $3)
     on conflict (user_id) do update set screening_mode = excluded.screening_mode,
       screening_criteria = excluded.screening_criteria, updated_at = now()`,
    [userId, input.mode, input.criteria ? input.criteria : null],
  );
  return loadScreeningSettings(userId);
}
