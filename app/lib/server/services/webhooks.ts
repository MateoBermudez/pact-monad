import "server-only";
import type { Queryable } from "@/lib/server/db";
import { nextActionFor, type Party, type WebhookData, type WebhookEventType } from "@/lib/shared/webhooks";

export type WebhookRecipient = { userId: string; role: Party };

// Anota el aviso para cada endpoint activo de los destinatarios que lo pidió (o que no filtró eventos).
// Se llama dentro de la misma transacción que el cambio de estado: si la transacción se revierte, el aviso no existe;
// si se confirma, el aviso existe aunque la función muera justo después. La entrega la hace el worker.
export async function emitWebhook<T extends WebhookEventType>(
  db: Queryable,
  args: { type: T; recipients: WebhookRecipient[]; data: WebhookData[T]; dedupe?: string },
): Promise<void> {
  const context: Record<string, unknown> = { ...args.data };

  for (const recipient of args.recipients) {
    const payload = {
      recipientRole: recipient.role,
      data: args.data,
      nextAction: nextActionFor(args.type, recipient.role, context),
    };
    await db.query(
      `insert into webhook_deliveries (endpoint_id, event, payload, dedupe_key)
       select e.id, $2, $3::jsonb, $4
         from webhook_endpoints e
        where e.user_id = $1 and e.active and (cardinality(e.events) = 0 or $2 = any(e.events))
       on conflict (endpoint_id, dedupe_key) do nothing`,
      [recipient.userId, args.type, JSON.stringify(payload), args.dedupe ? `${args.type}:${args.dedupe}` : null],
    );
  }
}
