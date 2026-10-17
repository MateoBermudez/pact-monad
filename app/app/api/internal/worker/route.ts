import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { serverEnv } from "@/lib/server/env";
import { runWorker } from "@/lib/server/services/worker";

// Aguanta lo que dura un paso del worker; en Vercel con Fluid compute el máximo es de 300 s.
export const maxDuration = 60;

const digest = (value: string) => createHash("sha256").update(value).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

// Lo llaman Supabase (pg_cron cada pocos segundos y un webhook de la base cuando entra trabajo) y, de respaldo, el
// cron de Vercel. Acepta el secreto en x-pact-secret o el CRON_SECRET de Vercel en "Authorization: Bearer".
function authorize(request: Request): "ok" | "forbidden" | "disabled" {
  const { internalSecret, cronSecret } = serverEnv;
  if (!internalSecret && !cronSecret) return "disabled";

  const direct = request.headers.get("x-pact-secret");
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (internalSecret && direct && same(direct, internalSecret)) return "ok";
  if (cronSecret && bearer && same(bearer, cronSecret)) return "ok";
  return "forbidden";
}

async function handle(request: Request): Promise<Response> {
  await connection();
  const access = authorize(request);
  if (access === "disabled") return Response.json({ error: "disabled", message: "El worker no está configurado" }, { status: 503 });
  if (access === "forbidden") return Response.json({ error: "forbidden" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sync?: unknown };
  try {
    return Response.json(await runWorker({ budgetMs: 45_000, sync: body.sync !== false }));
  } catch (error) {
    console.error("[internal/worker]", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export const POST = handle;
export const GET = handle;
