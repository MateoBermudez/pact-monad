import "server-only";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/server/db";
import { conflict, notFound } from "@/lib/server/http";
import { assertWebhookUrl } from "@/lib/server/webhooks/url";
import type { CreateWebhookInput, UpdateWebhookInput } from "@/lib/shared/schemas";
import type { WebhookDeliveryDto, WebhookEndpointDto, WebhookEventType } from "@/lib/shared/webhooks";

const MAX_ENDPOINTS_PER_USER = 5;
const SELECT = "id, url, events, active, consecutive_failures, last_success_at, last_failure_at, created_at";

type EndpointRow = {
  id: string;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  consecutive_failures: number;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  created_at: Date;
};

const toDto = (row: EndpointRow): WebhookEndpointDto => ({
  id: row.id,
  url: row.url,
  events: row.events,
  active: row.active,
  consecutiveFailures: row.consecutive_failures,
  lastSuccessAt: row.last_success_at?.toISOString() ?? null,
  lastFailureAt: row.last_failure_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

const newSecret = () => `whsec_${randomBytes(32).toString("base64url")}`;

export async function listEndpoints(userId: string): Promise<WebhookEndpointDto[]> {
  const rows = await query<EndpointRow>(`select ${SELECT} from webhook_endpoints where user_id = $1 order by created_at`, [userId]);
  return rows.map(toDto);
}

// El secreto solo se muestra al crear el endpoint o al rotarlo: con él se verifica la firma de cada aviso.
export async function createEndpoint(userId: string, input: CreateWebhookInput): Promise<{ endpoint: WebhookEndpointDto; secret: string }> {
  const url = await assertWebhookUrl(input.url);
  const [{ total }] = await query<{ total: number }>("select count(*)::int as total from webhook_endpoints where user_id = $1", [userId]);
  if (total >= MAX_ENDPOINTS_PER_USER) throw conflict(`Ya tienes ${MAX_ENDPOINTS_PER_USER} webhooks; borra alguno primero`);

  const secret = newSecret();
  const [row] = await query<EndpointRow>(
    `insert into webhook_endpoints (user_id, url, secret, events) values ($1, $2, $3, $4) returning ${SELECT}`,
    [userId, url.toString(), secret, input.events],
  );
  return { endpoint: toDto(row), secret };
}

export async function updateEndpoint(userId: string, endpointId: string, input: UpdateWebhookInput): Promise<WebhookEndpointDto> {
  const url = input.url ? (await assertWebhookUrl(input.url)).toString() : null;
  // Reactivar un endpoint también reinicia su contador de fallos.
  const [row] = await query<EndpointRow>(
    `update webhook_endpoints
        set url = coalesce($3, url), events = coalesce($4::text[], events), active = coalesce($5, active),
            consecutive_failures = case when $5 is true then 0 else consecutive_failures end
      where id = $1 and user_id = $2
      returning ${SELECT}`,
    [endpointId, userId, url, input.events ?? null, input.active ?? null],
  );
  if (!row) throw notFound("Webhook");
  return toDto(row);
}

export async function deleteEndpoint(userId: string, endpointId: string): Promise<void> {
  const deleted = await query("delete from webhook_endpoints where id = $1 and user_id = $2 returning id", [endpointId, userId]);
  if (deleted.length === 0) throw notFound("Webhook");
}

export async function rotateSecret(userId: string, endpointId: string): Promise<{ secret: string }> {
  const secret = newSecret();
  const updated = await query("update webhook_endpoints set secret = $3 where id = $1 and user_id = $2 returning id", [endpointId, userId, secret]);
  if (updated.length === 0) throw notFound("Webhook");
  return { secret };
}

// Encola un aviso de prueba solo para este endpoint; el worker lo envía.
export async function enqueuePing(userId: string, endpointId: string): Promise<{ deliveryId: string }> {
  const [row] = await query<{ id: string }>(
    `insert into webhook_deliveries (endpoint_id, event, payload)
     select e.id, 'ping', $3::jsonb from webhook_endpoints e where e.id = $1 and e.user_id = $2
     returning id`,
    [endpointId, userId, JSON.stringify({ recipientRole: null, data: { message: "Prueba de PACT: tu webhook está bien configurado" }, nextAction: { actor: "none", action: "none", youAct: false, hint: "No hay acción pendiente" } })],
  );
  if (!row) throw notFound("Webhook");
  return { deliveryId: row.id };
}

export async function listDeliveries(userId: string, endpointId: string): Promise<WebhookDeliveryDto[]> {
  const [owned] = await query("select 1 from webhook_endpoints where id = $1 and user_id = $2", [endpointId, userId]);
  if (!owned) throw notFound("Webhook");
  const rows = await query<{
    id: string;
    event: WebhookEventType;
    status: WebhookDeliveryDto["status"];
    attempts: number;
    next_attempt_at: Date;
    response_status: number | null;
    last_error: string | null;
    created_at: Date;
    delivered_at: Date | null;
  }>(
    `select id, event, status, attempts, next_attempt_at, response_status, last_error, created_at, delivered_at
       from webhook_deliveries where endpoint_id = $1 order by created_at desc limit 50`,
    [endpointId],
  );
  return rows.map((row) => ({
    id: row.id,
    event: row.event,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at.toISOString(),
    responseStatus: row.response_status,
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
    deliveredAt: row.delivered_at?.toISOString() ?? null,
  }));
}
