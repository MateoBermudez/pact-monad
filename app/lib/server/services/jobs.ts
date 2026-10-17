import "server-only";
import { z } from "zod";
import type { Queryable } from "@/lib/server/db";
import { query } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { ensureMonthlyGrant, getBalance } from "@/lib/server/services/credits";
import { reviewAgreement } from "@/lib/server/services/decisions";
import { CREDIT_COSTS } from "@/lib/shared/credits";

const LEASE_SECONDS = 300;
const reviewPayloadSchema = z.object({ agreementId: z.string().uuid() });

export type Job = { id: string; kind: "review_delivery"; payload: unknown; attempts: number; maxAttempts: number };
export type JobOutcome = "done" | "retry" | "failed";

// Se llama dentro de la transacción del indexador: la tarea nace junto con el evento y no se puede perder.
export async function enqueueReviewJob(db: Queryable, agreementId: string): Promise<void> {
  await db.query(
    `insert into jobs (kind, payload, dedupe_key) values ('review_delivery', $1::jsonb, $2)
     on conflict (dedupe_key) do nothing`,
    [JSON.stringify({ agreementId }), `review:${agreementId}`],
  );
}

// Reclamar es un arrendamiento: sube los intentos y empuja run_after. Si el worker muere, la tarea vuelve a estar
// disponible sola cuando vence el plazo; si dos workers compiten, SKIP LOCKED reparte sin duplicar.
export async function claimJobs(limit: number): Promise<Job[]> {
  const rows = await query<{ id: string; kind: Job["kind"]; payload: unknown; attempts: number; max_attempts: number }>(
    `update jobs set attempts = attempts + 1, run_after = now() + make_interval(secs => $2)
      where id in (select id from jobs where status = 'pending' and run_after <= now()
                    order by run_after limit $1 for update skip locked)
      returning id::text as id, kind, payload, attempts, max_attempts`,
    [limit, LEASE_SECONDS],
  );
  return rows.map((row) => ({ id: row.id, kind: row.kind, payload: row.payload, attempts: row.attempts, maxAttempts: row.max_attempts }));
}

const backoffSeconds = (attempts: number) => Math.min(15 * 2 ** (attempts - 1), 900);

// Los errores de red, de la IA caída o de una revisión en curso se reintentan; los demás (reglas ausentes, acuerdo
// ajeno...) no mejoran por reintentar.
function isRetryable(error: unknown): boolean {
  return error instanceof ApiError ? error.status === 409 || error.status >= 500 : true;
}

// Revisa la entrega solo si el cliente activó la autonomía y tiene créditos; si no, no hace nada y la decisión queda
// para la persona. El cliente paga la revisión con sus créditos.
async function reviewDelivery(payload: unknown): Promise<void> {
  const { agreementId } = reviewPayloadSchema.parse(payload);
  const [row] = await query<{ client_id: string; status: string; enabled: boolean }>(
    `select a.client_id, a.status, coalesce(s.auto_release, false) as enabled
       from agreements a left join ai_settings s on s.user_id = a.client_id
      where a.id = $1`,
    [agreementId],
  );
  if (!row || row.status !== "Delivered" || !row.enabled) return;

  await ensureMonthlyGrant(row.client_id);
  if ((await getBalance(row.client_id)) < CREDIT_COSTS.review) return;
  await reviewAgreement({ agreementId, clientId: row.client_id, release: true });
}

export async function runJob(job: Job): Promise<JobOutcome> {
  try {
    await reviewDelivery(job.payload);
    await query("update jobs set status = 'done', finished_at = now(), last_error = null where id = $1", [job.id]);
    return "done";
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    if (isRetryable(error) && job.attempts < job.maxAttempts) {
      await query("update jobs set run_after = now() + make_interval(secs => $2), last_error = $3 where id = $1", [
        job.id,
        backoffSeconds(job.attempts),
        message,
      ]);
      return "retry";
    }
    await query("update jobs set status = 'failed', finished_at = now(), last_error = $2 where id = $1", [job.id, message]);
    return "failed";
  }
}
