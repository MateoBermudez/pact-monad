import "server-only";
import { formatEther } from "ethers";
import type { PoolClient } from "pg";
import { configuredContractAddress } from "@/lib/server/chain/contract";
import { decodeLog, serializeEvent, type ChainEvent } from "@/lib/server/chain/events";
import { getProvider } from "@/lib/server/chain/provider";
import { query, withTransaction } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { enqueueReviewJob } from "@/lib/server/services/jobs";
import { ensureUser } from "@/lib/server/services/users";
import { emitWebhook } from "@/lib/server/services/webhooks";
import { trimMon } from "@/lib/shared/money";
import type { AgreementStatusName } from "@/lib/shared/pact";

// El RPC público de Monad limita eth_getLogs a 100 bloques por consulta.
const BLOCK_RANGE = 100;
const MAX_RANGES_PER_RUN = 30;
const MIN_INTERVAL_MS = 1_000;
// Un evento más viejo que esto (frente al bloque más reciente) se indexa pero no genera avisos ni revisiones.
const HISTORICAL_SECONDS = 600;

export type SyncResult = {
  status: "ok" | "no_contract";
  head: number;
  lastBlock: number;
  eventsApplied: number;
  behindBy: number;
};

type EventMeta = { contract: string; txHash: string; logIndex: number; blockNumber: number; blockTime: number; historical: boolean };

const EMPTY_RESULT: SyncResult = { status: "no_contract", head: 0, lastBlock: 0, eventsApplied: 0, behindBy: 0 };

async function loadCursor(contract: string): Promise<{ stored: number; start: number }> {
  const [state] = await query<{ last_block: string; contract_address: string | null }>(
    "select last_block, contract_address from chain_sync_state",
  );
  const stored = state.contract_address === contract ? Number(state.last_block) : 0;
  if (state.contract_address !== contract) {
    await query("update chain_sync_state set last_block = 0, contract_address = $1, updated_at = now()", [contract]);
  }
  return { stored, start: stored === 0 ? Math.max(serverEnv.contractDeployBlock - 1, 0) : stored };
}

type AgreementEvent = "agreement.created" | "agreement.accepted" | "agreement.delivered" | "agreement.approved" | "agreement.cancelled";

// Avisa a las dos partes de un cambio del acuerdo. Va dentro de la transacción del indexador.
async function emitAgreement(client: PoolClient, type: AgreementEvent, agreementId: string, meta: EventMeta): Promise<void> {
  const { rows } = await client.query<{
    id: string;
    chain_agreement_id: string;
    contract_address: string;
    listing_id: string | null;
    client_id: string;
    provider_id: string;
    amount_wei: string;
    status: AgreementStatusName;
    evidence_url: string | null;
    provider_note: string | null;
  }>(
    `select id, chain_agreement_id::text as chain_agreement_id, contract_address, listing_id, client_id, provider_id,
            amount_wei::text as amount_wei, status, evidence_url, provider_note
       from agreements where id = $1`,
    [agreementId],
  );
  const agreement = rows[0];
  if (!agreement || meta.historical) return;

  const ref = {
    agreementId: agreement.id,
    chainAgreementId: agreement.chain_agreement_id,
    contractAddress: agreement.contract_address,
    listingId: agreement.listing_id,
    amountMon: trimMon(formatEther(BigInt(agreement.amount_wei))),
    status: agreement.status,
  };
  const recipients = [
    { userId: agreement.client_id, role: "client" as const },
    { userId: agreement.provider_id, role: "provider" as const },
  ];
  const dedupe = `${meta.txHash}:${meta.logIndex}`;

  if (type === "agreement.delivered") {
    await emitWebhook(client, {
      type,
      recipients,
      dedupe,
      data: { ...ref, evidenceUrl: agreement.evidence_url ?? "", providerNote: agreement.provider_note ?? "" },
    });
    return;
  }
  await emitWebhook(client, { type, recipients, dedupe, data: ref });
}

async function applyEvent(client: PoolClient, event: ChainEvent, meta: EventMeta): Promise<void> {
  const inserted = await client.query(
    `insert into chain_events (tx_hash, log_index, block_number, block_time, contract_address, chain_agreement_id, event, data)
     values ($1, $2, $3, to_timestamp($4), $5, $6, $7, $8)
     on conflict (tx_hash, log_index) do nothing`,
    [
      meta.txHash,
      meta.logIndex,
      meta.blockNumber,
      meta.blockTime,
      meta.contract,
      "id" in event ? event.id.toString() : null,
      event.name,
      JSON.stringify(serializeEvent(event)),
    ],
  );
  if (inserted.rowCount === 0) return;

  const chainId = "id" in event ? event.id.toString() : null;
  const transition = async (type: AgreementEvent, sql: string, params: unknown[]): Promise<string | null> => {
    const { rows } = await client.query<{ id: string }>(sql, params);
    if (!rows[0]) return null;
    await emitAgreement(client, type, rows[0].id, meta);
    return rows[0].id;
  };

  switch (event.name) {
    case "AgreementCreated": {
      const clientId = await ensureUser(client, event.client);
      const providerId = await ensureUser(client, event.provider);

      const { rows: matches } = await client.query<{ listing_id: string; application_id: string }>(
        `select l.id as listing_id, a.id as application_id
           from listings l
           join applications a on a.id = l.awarded_application_id
          where l.rules_hash = $1 and l.client_id = $2 and a.provider_id = $3
            and not exists (select 1 from agreements g where g.listing_id = l.id and g.status <> 'Cancelled')`,
        [event.rulesHash, clientId, providerId],
      );
      await transition(
        "agreement.created",
        `insert into agreements (contract_address, chain_agreement_id, listing_id, application_id, client_id, provider_id,
                                 amount_wei, deadline, status, rules_hash, description, create_tx)
         values ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), 'Created', $9, $10, $11)
         on conflict (contract_address, chain_agreement_id) do nothing
         returning id`,
        [
          meta.contract,
          chainId,
          matches[0]?.listing_id ?? null,
          matches[0]?.application_id ?? null,
          clientId,
          providerId,
          event.amount.toString(),
          Number(event.deadline),
          event.rulesHash,
          event.description,
          meta.txHash,
        ],
      );
      return;
    }
    case "AgreementAccepted":
      await transition(
        "agreement.accepted",
        "update agreements set status = 'Accepted' where contract_address = $1 and chain_agreement_id = $2 and status = 'Created' returning id",
        [meta.contract, chainId],
      );
      return;
    case "DeliveryRegistered": {
      const agreementId = await transition(
        "agreement.delivered",
        `update agreements set status = 'Delivered', evidence_url = $3, provider_note = $4
          where contract_address = $1 and chain_agreement_id = $2 and status = 'Accepted'
          returning id`,
        [meta.contract, chainId, event.evidenceUrl, event.note],
      );
      // La revisión de la IA queda anotada en la misma transacción: no se pierde aunque la función muera ahora.
      if (agreementId && !meta.historical) await enqueueReviewJob(client, agreementId);
      return;
    }
    case "AgreementApproved":
      await transition(
        "agreement.approved",
        "update agreements set status = 'Approved' where contract_address = $1 and chain_agreement_id = $2 and status = 'Delivered' returning id",
        [meta.contract, chainId],
      );
      return;
    case "AgreementCancelled":
      await transition(
        "agreement.cancelled",
        "update agreements set status = 'Cancelled' where contract_address = $1 and chain_agreement_id = $2 and status in ('Created', 'Accepted') returning id",
        [meta.contract, chainId],
      );
      return;
    case "AutoReleaseLimitSet": {
      const userId = await ensureUser(client, event.client);
      await client.query(
        `insert into ai_settings (user_id, auto_release, auto_release_limit_mon) values ($1, $2, $3)
         on conflict (user_id) do update
           set auto_release = excluded.auto_release, auto_release_limit_mon = excluded.auto_release_limit_mon`,
        [userId, event.limit > BigInt(0), formatEther(event.limit)],
      );
      return;
    }
    case "AgentReleased":
      return;
  }
}

async function runSync(): Promise<SyncResult> {
  const contract = configuredContractAddress();
  if (!contract) return EMPTY_RESULT;

  const provider = getProvider();
  const headBlock = await provider.getBlock(serverEnv.indexerBlockTag);
  const head = headBlock?.number ?? (await provider.getBlockNumber());
  const headTime = headBlock?.timestamp ?? Math.floor(Date.now() / 1000);
  const { stored, start } = await loadCursor(contract);

  let storedCursor = stored;
  let cursor = start;
  let eventsApplied = 0;

  for (let range = 0; range < MAX_RANGES_PER_RUN && cursor < head; range++) {
    const fromBlock = cursor + 1;
    const toBlock = Math.min(fromBlock + BLOCK_RANGE - 1, head);
    const logs = await provider.getLogs({ address: contract, fromBlock, toBlock });
    const blockTimes = new Map<number, number>();
    for (const log of logs) {
      if (!blockTimes.has(log.blockNumber)) {
        blockTimes.set(log.blockNumber, (await provider.getBlock(log.blockNumber))?.timestamp ?? headTime);
      }
    }

    // Compare-and-swap sobre last_block: si otra instancia ya avanzó este tramo, esta se retira sin aplicar nada.
    const applied = await withTransaction(async (client) => {
      const claim = await client.query(
        "update chain_sync_state set last_block = $1, updated_at = now() where contract_address = $2 and last_block = $3",
        [toBlock, contract, storedCursor],
      );
      if (claim.rowCount === 0) return null;

      let count = 0;
      for (const log of logs) {
        const event = decodeLog(log);
        if (!event) continue;
        const blockTime = blockTimes.get(log.blockNumber) ?? headTime;
        await applyEvent(client, event, {
          contract,
          txHash: log.transactionHash,
          logIndex: log.index,
          blockNumber: log.blockNumber,
          blockTime,
          historical: headTime - blockTime > HISTORICAL_SECONDS,
        });
        count++;
      }
      return { count };
    });

    if (!applied) break;
    eventsApplied += applied.count;
    storedCursor = toBlock;
    cursor = toBlock;
  }

  return { status: "ok", head, lastBlock: cursor, eventsApplied, behindBy: Math.max(head - cursor, 0) };
}

let inflight: Promise<SyncResult> | null = null;
let lastResult: SyncResult | null = null;
let lastFinishedAt = 0;

// Una sola sincronización a la vez por proceso; las llamadas cercanas reutilizan el último resultado.
export function syncChain(options: { force?: boolean } = {}): Promise<SyncResult> {
  if (inflight) return inflight;
  if (!options.force && lastResult && Date.now() - lastFinishedAt < MIN_INTERVAL_MS) return Promise.resolve(lastResult);

  inflight = runSync()
    .then((result) => {
      lastResult = result;
      return result;
    })
    .finally(() => {
      inflight = null;
      lastFinishedAt = Date.now();
    });
  return inflight;
}
