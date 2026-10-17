import "server-only";
import { formatEther } from "ethers";
import { configuredContractAddress } from "@/lib/server/chain/contract";
import { getProvider } from "@/lib/server/chain/provider";
import { query } from "@/lib/server/db";
import { ensureMonthlyGrant, getBalance } from "@/lib/server/services/credits";
import type { SessionUser } from "@/lib/shared/auth";
import type { ActivityDto, DashboardDto } from "@/lib/shared/agreements";
import { trimMon } from "@/lib/shared/money";
import type { AgreementStatusName } from "@/lib/shared/pact";


const emptyCounts = (): Record<AgreementStatusName, number> => ({ Created: 0, Accepted: 0, Delivered: 0, Approved: 0, Cancelled: 0 });

const EVENT_LABELS: Record<string, string> = {
  AgreementCreated: "Acuerdo creado y fondos bloqueados",
  AgreementAccepted: "Acuerdo aceptado",
  DeliveryRegistered: "Entrega registrada",
  AgreementApproved: "Pago liberado",
  AgreementCancelled: "Acuerdo cancelado y reembolsado",
  AgentReleased: "La IA liberó el pago",
  AutoReleaseLimitSet: "Límite de pago de la IA actualizado",
};

const mon = (wei: string) => trimMon(formatEther(BigInt(wei)));

async function availableBalance(wallet: string): Promise<string | null> {
  try {
    return trimMon(formatEther(await getProvider().getBalance(wallet)));
  } catch {
    return null;
  }
}

function toActivity(row: {
  event: string;
  tx_hash: string;
  block_number: string;
  created_at: Date;
  data: Record<string, string>;
  agreement_id: string | null;
}): ActivityDto {
  const wei = row.data.amount ?? row.data.limit;
  return {
    event: row.event,
    label: EVENT_LABELS[row.event] ?? row.event,
    txHash: row.tx_hash,
    blockNumber: Number(row.block_number),
    agreementId: row.agreement_id,
    amountMon: wei ? mon(wei) : null,
    at: row.created_at.toISOString(),
  };
}

// Panel financiero: lo calcula la base a partir de los eventos indexados; solo el saldo disponible se lee de la wallet.
export async function loadDashboard(user: SessionUser): Promise<DashboardDto> {
  const contract = configuredContractAddress() ?? "";
  await ensureMonthlyGrant(user.id);

  const [[money], statusRows, [listings], [pending], [settings], activity, credits, available] = await Promise.all([
    query<{ locked: string; incoming: string; received: string; paid: string; refunded: string }>(
      `select
         coalesce(sum(amount_wei) filter (where client_id = $1 and status in ('Created','Accepted','Delivered')), 0)::text as locked,
         coalesce(sum(amount_wei) filter (where provider_id = $1 and status in ('Created','Accepted','Delivered')), 0)::text as incoming,
         coalesce(sum(amount_wei) filter (where provider_id = $1 and status = 'Approved'), 0)::text as received,
         coalesce(sum(amount_wei) filter (where client_id = $1 and status = 'Approved'), 0)::text as paid,
         coalesce(sum(amount_wei) filter (where client_id = $1 and status = 'Cancelled'), 0)::text as refunded
       from agreements where contract_address = $2 and (client_id = $1 or provider_id = $1)`,
      [user.id, contract],
    ),
    query<{ role: "client" | "provider"; status: AgreementStatusName; n: number }>(
      `select case when client_id = $1 then 'client' else 'provider' end as role, status, count(*)::int as n
         from agreements where contract_address = $2 and (client_id = $1 or provider_id = $1)
        group by 1, 2`,
      [user.id, contract],
    ),
    query<{ n: number }>("select count(*)::int as n from listings where client_id = $1 and status = 'open'", [user.id]),
    query<{ n: number }>(
      `select count(*)::int as n from applications a join listings l on l.id = a.listing_id
        where l.client_id = $1 and l.status = 'open' and a.status = 'submitted'`,
      [user.id],
    ),
    query<{ auto_release: boolean; limit_mon: string }>(
      "select auto_release, auto_release_limit_mon::text as limit_mon from ai_settings where user_id = $1",
      [user.id],
    ),
    query<{ event: string; tx_hash: string; block_number: string; created_at: Date; data: Record<string, string>; agreement_id: string | null }>(
      `select e.event, e.tx_hash, e.block_number::text as block_number, coalesce(e.block_time, e.created_at) as created_at, e.data, a.id as agreement_id
         from chain_events e
         left join agreements a on a.contract_address = e.contract_address and a.chain_agreement_id = e.chain_agreement_id
        where e.contract_address = $2
          and ((a.id is not null and (a.client_id = $1 or a.provider_id = $1))
               or (e.event = 'AutoReleaseLimitSet' and e.data ->> 'client' = $3))
        order by e.block_number desc, e.id desc limit 20`,
      [user.id, contract, user.wallet],
    ),
    getBalance(user.id),
    user.wallet ? availableBalance(user.wallet) : null,
  ]);

  const asClient = emptyCounts();
  const asProvider = emptyCounts();
  for (const row of statusRows) (row.role === "client" ? asClient : asProvider)[row.status] = row.n;

  return {
    wallet: user.wallet,
    availableMon: available,
    lockedMon: mon(money?.locked ?? "0"),
    incomingPendingMon: mon(money?.incoming ?? "0"),
    receivedMon: mon(money?.received ?? "0"),
    paidMon: mon(money?.paid ?? "0"),
    refundedMon: mon(money?.refunded ?? "0"),
    asClient,
    asProvider,
    needsMyAction: asClient.Delivered + asProvider.Created + asProvider.Accepted,
    openListings: listings?.n ?? 0,
    pendingApplicationsToReview: pending?.n ?? 0,
    credits,
    autoRelease: { enabled: settings?.auto_release ?? false, limitMon: trimMon(settings?.limit_mon ?? "0") },
    activity: activity.map(toActivity),
  };
}

// Huella barata de "algo mío cambió": si cambia entre dos consultas, el panel debe refrescarse.
export async function loadChangeVersion(userId: string): Promise<string> {
  const [row] = await query<{ version: string }>(
    `select concat_ws('|',
       coalesce((select max(e.id) from chain_events e
                   join agreements a on a.contract_address = e.contract_address and a.chain_agreement_id = e.chain_agreement_id
                  where a.client_id = $1 or a.provider_id = $1), 0),
       coalesce((select max(id) from credit_ledger where user_id = $1), 0),
       coalesce((select extract(epoch from max(updated_at)) from agreements where client_id = $1 or provider_id = $1), 0),
       coalesce((select extract(epoch from max(l.updated_at)) from listings l where l.client_id = $1), 0),
       coalesce((select extract(epoch from max(a.updated_at)) from applications a
                   left join listings l on l.id = a.listing_id where a.provider_id = $1 or l.client_id = $1), 0),
       coalesce((select extract(epoch from max(d.created_at)) from decisions d
                   join agreements a on a.id = d.agreement_id where a.client_id = $1 or a.provider_id = $1), 0),
       coalesce((select extract(epoch from updated_at) from ai_settings where user_id = $1), 0),
       coalesce((select max(id) from notifications where user_id = $1), 0),
       (select count(*) from notifications where user_id = $1 and read_at is null)
     ) as version`,
    [userId],
  );
  return row.version;
}
