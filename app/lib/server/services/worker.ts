import "server-only";
import { syncChain } from "@/lib/server/chain/indexer";
import { query } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { claimJobs, runJob, type JobOutcome } from "@/lib/server/services/jobs";
import { BlockedAddressError, postWebhook } from "@/lib/server/webhooks/http";
import { assertWebhookUrl } from "@/lib/server/webhooks/url";
import { signWebhook } from "@/lib/shared/webhook-signature";
import type { NextAction, Party, WebhookEnvelope, WebhookEventType } from "@/lib/shared/webhooks";

const DELIVERY_LEASE_SECONDS = 120;
const MAX_DELIVERY_ATTEMPTS = 6;
// Espera tras el intento n: 30 s, 2 min, 10 min, 1 h, 6 h.
const DELIVERY_BACKOFF_SECONDS = [30, 120, 600, 3600, 21600];
const DISABLE_AFTER_CONSECUTIVE_FAILURES = 20;

type DeliveryRow = {
  id: string;
  event: WebhookEventType;
  payload: { recipientRole: Party | null; data: WebhookEnvelope["data"]; nextAction: NextAction };
  attempts: number;
  created_at: Date;
  endpoint_id: string;
  url: string;
  secret: string;
  active: boolean;
};

type DeliveryOutcome = "delivered" | "retry" | "failed";

// Mismo arrendamiento que las tareas: reclamar sube los intentos y empuja next_attempt_at; si el worker muere a mitad,
// el aviso se reintenta solo cuando vence el plazo.
async function claimDeliveries(limit: number): Promise<DeliveryRow[]> {
  return query<DeliveryRow>(
    `update webhook_deliveries d
        set attempts = d.attempts + 1, next_attempt_at = now() + make_interval(secs => $2)
       from webhook_endpoints e
      where e.id = d.endpoint_id
        and d.id in (select id from webhook_deliveries where status = 'pending' and next_attempt_at <= now()
                      order by next_attempt_at, created_at limit $1 for update skip locked)
      returning d.id, d.event, d.payload, d.attempts, d.created_at, e.id as endpoint_id, e.url, e.secret, e.active`,
    [limit, DELIVERY_LEASE_SECONDS],
  );
}

async function recordFailure(delivery: DeliveryRow, error: string, status: number | null, permanent: boolean): Promise<DeliveryOutcome> {
  const exhausted = permanent || delivery.attempts >= MAX_DELIVERY_ATTEMPTS;
  const wait = DELIVERY_BACKOFF_SECONDS[delivery.attempts - 1] ?? DELIVERY_BACKOFF_SECONDS.at(-1) ?? 21600;

  await query(
    `update webhook_deliveries
        set status = $2, next_attempt_at = now() + make_interval(secs => $3), response_status = $4, last_error = $5
      where id = $1`,
    [delivery.id, exhausted ? "failed" : "pending", wait, status, error.slice(0, 500)],
  );
  await query(
    `update webhook_endpoints
        set consecutive_failures = consecutive_failures + 1, last_failure_at = now(),
            active = active and consecutive_failures + 1 < $2
      where id = $1`,
    [delivery.endpoint_id, DISABLE_AFTER_CONSECUTIVE_FAILURES],
  );
  return exhausted ? "failed" : "retry";
}

async function sendDelivery(delivery: DeliveryRow): Promise<DeliveryOutcome> {
  if (!delivery.active) return recordFailure(delivery, "El webhook está desactivado", null, true);

  try {
    // Se revalida en cada envío: el DNS o la configuración pueden haber cambiado desde que se registró.
    const url = await assertWebhookUrl(delivery.url);
    const envelope: WebhookEnvelope = {
      id: delivery.id,
      type: delivery.event,
      createdAt: delivery.created_at.toISOString(),
      recipientRole: delivery.payload.recipientRole,
      data: delivery.payload.data,
      nextAction: delivery.payload.nextAction,
    };
    const body = JSON.stringify(envelope);
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await postWebhook(url, body, {
      "content-type": "application/json",
      "user-agent": "PACT-Webhooks/1",
      "x-pact-event": delivery.event,
      "x-pact-delivery": delivery.id,
      "x-pact-signature": await signWebhook(delivery.secret, timestamp, body),
    });

    if (response.status >= 200 && response.status < 300) {
      await query(
        "update webhook_deliveries set status = 'delivered', delivered_at = now(), response_status = $2, last_error = null where id = $1",
        [delivery.id, response.status],
      );
      await query("update webhook_endpoints set consecutive_failures = 0, last_success_at = now() where id = $1", [delivery.endpoint_id]);
      return "delivered";
    }
    return recordFailure(delivery, `HTTP ${response.status}${response.snippet ? `: ${response.snippet}` : ""}`, response.status, false);
  } catch (error) {
    const permanent = error instanceof ApiError || error instanceof BlockedAddressError;
    return recordFailure(delivery, error instanceof Error ? error.message : String(error), null, permanent);
  }
}

// Los avisos de un mismo destinatario salen uno tras otro, en el orden en que se crearon; destinatarios distintos van en
// paralelo. Así un agente no recibe "acuerdo creado" antes que "fuiste elegido". Los reintentos pueden reordenar.
async function sendInOrder(deliveries: DeliveryRow[]): Promise<DeliveryOutcome[]> {
  const byEndpoint = new Map<string, DeliveryRow[]>();
  for (const delivery of deliveries) byEndpoint.set(delivery.endpoint_id, [...(byEndpoint.get(delivery.endpoint_id) ?? []), delivery]);

  const groups = await Promise.all(
    [...byEndpoint.values()].map(async (group) => {
      const outcomes: DeliveryOutcome[] = [];
      for (const delivery of group.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())) {
        outcomes.push(await sendDelivery(delivery));
      }
      return outcomes;
    }),
  );
  return groups.flat();
}

export type WorkerReport = {
  synced: boolean;
  jobs: Record<JobOutcome, number>;
  webhooks: Record<DeliveryOutcome, number>;
  elapsedMs: number;
};

// Un paso del worker: sincroniza con la cadena (si se pide), ejecuta las tareas vencidas y envía los webhooks vencidos,
// hasta agotar el presupuesto de tiempo. Es seguro llamarlo varias veces a la vez.
export async function runWorker(options: { budgetMs: number; sync: boolean }): Promise<WorkerReport> {
  const startedAt = Date.now();
  const deadline = startedAt + options.budgetMs;
  const report: WorkerReport = {
    synced: false,
    jobs: { done: 0, retry: 0, failed: 0 },
    webhooks: { delivered: 0, retry: 0, failed: 0 },
    elapsedMs: 0,
  };

  if (options.sync) {
    try {
      await syncChain({ force: true });
      report.synced = true;
    } catch (error) {
      console.error("[worker] no se pudo sincronizar con la cadena:", error);
    }
  }

  while (Date.now() < deadline) {
    const [jobs, deliveries] = await Promise.all([claimJobs(3), claimDeliveries(10)]);
    if (jobs.length === 0 && deliveries.length === 0) break;

    const [jobOutcomes, deliveryOutcomes] = await Promise.all([Promise.all(jobs.map(runJob)), sendInOrder(deliveries)]);
    for (const outcome of jobOutcomes) report.jobs[outcome]++;
    for (const outcome of deliveryOutcomes) report.webhooks[outcome]++;
  }

  report.elapsedMs = Date.now() - startedAt;
  return report;
}
