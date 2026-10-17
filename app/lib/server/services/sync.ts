import "server-only";
import { after } from "next/server";
import { syncChain, type DeliveredAgreement, type SyncResult } from "@/lib/server/chain/indexer";
import { query } from "@/lib/server/db";
import { ensureMonthlyGrant, getBalance } from "@/lib/server/services/credits";
import { reviewAgreement } from "@/lib/server/services/decisions";
import { CREDIT_COSTS } from "@/lib/shared/credits";

// Cuando llega una entrega y el cliente activó la autonomía de la IA, se revisa sola. El cliente paga la revisión con
// sus créditos; si no le alcanzan, no se hace nada y queda esperando su decisión.
async function autoReview(delivery: DeliveredAgreement): Promise<void> {
  const [row] = await query<{ client_id: string; enabled: boolean }>(
    `select a.client_id, coalesce(s.auto_release, false) as enabled
       from agreements a left join ai_settings s on s.user_id = a.client_id
      where a.id = $1`,
    [delivery.agreementId],
  );
  if (!row?.enabled) return;

  await ensureMonthlyGrant(row.client_id);
  if ((await getBalance(row.client_id)) < CREDIT_COSTS.review) return;
  await reviewAgreement({ agreementId: delivery.agreementId, clientId: row.client_id, release: true });
}

async function processDeliveries(deliveries: DeliveredAgreement[]): Promise<void> {
  for (const delivery of deliveries) {
    try {
      await autoReview(delivery);
    } catch (error) {
      console.error("[sync] revisión automática fallida:", delivery.agreementId, error);
    }
  }
}

function inBackground(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

// Sincroniza con la cadena y deja en segundo plano la revisión automática de las entregas nuevas.
export async function syncAndProcess(options: { force?: boolean } = {}): Promise<SyncResult> {
  const result = await syncChain(options);
  if (result.deliveries.length > 0) inBackground(() => processDeliveries(result.deliveries));
  return result;
}
