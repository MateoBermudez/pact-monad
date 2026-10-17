import "server-only";
import { serverEnv } from "@/lib/server/env";

const AI_TIMEOUT_MS = 15_000;

export async function callAi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${serverEnv.aiApiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`El servicio de IA respondió ${res.status}`);
  return (await res.json()) as T;
}
