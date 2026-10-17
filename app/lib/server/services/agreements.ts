import "server-only";
import { formatEther } from "ethers";
import { configuredContractAddress } from "@/lib/server/chain/contract";
import { pool, query } from "@/lib/server/db";
import { notFound } from "@/lib/server/http";
import { loadDecisions } from "@/lib/server/services/decisions";
import { loadRules } from "@/lib/server/services/rules";
import type { SessionUser } from "@/lib/shared/auth";
import type { AgreementDetailDto, AgreementDto, DecisionVerdict, RatingDto } from "@/lib/shared/agreements";
import { trimMon } from "@/lib/shared/money";
import type { AgreementStatusName } from "@/lib/shared/pact";

type AgreementRow = {
  id: string;
  chain_agreement_id: string;
  contract_address: string;
  listing_id: string | null;
  listing_title: string | null;
  rules_version: number | null;
  client_id: string;
  provider_id: string;
  amount_wei: string;
  deadline: Date;
  status: AgreementStatusName;
  description: string | null;
  evidence_url: string | null;
  provider_note: string | null;
  rules_hash: string | null;
  create_tx: string | null;
  created_at: Date;
  updated_at: Date;
  client_wallet: string;
  client_name: string | null;
  client_username: string | null;
  provider_wallet: string;
  provider_name: string | null;
  provider_username: string | null;
  latest_verdict: DecisionVerdict | null;
  i_rated: boolean;
};

const SELECT_AGREEMENT = `
  select a.id, a.chain_agreement_id::text as chain_agreement_id, a.contract_address, a.listing_id,
         l.title as listing_title, l.rules_version, a.client_id, a.provider_id, a.amount_wei::text as amount_wei,
         a.deadline, a.status, a.description, a.evidence_url, a.provider_note, a.rules_hash, a.create_tx,
         a.created_at, a.updated_at,
         cu.wallet as client_wallet, cu.display_name as client_name, cu.username as client_username,
         pu.wallet as provider_wallet, pu.display_name as provider_name, pu.username as provider_username,
         (select d.verdict from decisions d where d.agreement_id = a.id order by d.created_at desc limit 1) as latest_verdict,
         exists (select 1 from ratings r where r.agreement_id = a.id and r.rater_id = $1) as i_rated
    from agreements a
    join users cu on cu.id = a.client_id
    join users pu on pu.id = a.provider_id
    left join listings l on l.id = a.listing_id`;

const toDto = (row: AgreementRow, userId: string): AgreementDto => {
  const isClient = row.client_id === userId;
  return {
    id: row.id,
    chainAgreementId: row.chain_agreement_id,
    contractAddress: row.contract_address,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    createdById: row.client_id,
    createdByUsername: row.client_username,
    role: isClient ? "client" : "provider",
    counterparty: isClient
      ? { id: row.provider_id, username: row.provider_username, wallet: row.provider_wallet, displayName: row.provider_name }
      : { id: row.client_id, username: row.client_username, wallet: row.client_wallet, displayName: row.client_name },
    amountMon: trimMon(formatEther(BigInt(row.amount_wei))),
    deadline: row.deadline.toISOString(),
    status: row.status,
    description: row.description,
    evidenceUrl: row.evidence_url,
    providerNote: row.provider_note,
    rulesHash: row.rules_hash,
    createTx: row.create_tx,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    latestVerdict: row.latest_verdict,
    iRated: row.i_rated,
  };
};

// Solo se muestran los acuerdos del contrato vigente: tras un redespliegue, los del contrato anterior quedan aparte.
export async function listAgreements(user: SessionUser): Promise<AgreementDto[]> {
  const contract = configuredContractAddress();
  if (!contract) return [];
  const rows = await query<AgreementRow>(
    `${SELECT_AGREEMENT} where a.contract_address = $2 and (a.client_id = $1 or a.provider_id = $1) order by a.updated_at desc`,
    [user.id, contract],
  );
  return rows.map((row) => toDto(row, user.id));
}

export async function getAgreementDetail(user: SessionUser, agreementId: string): Promise<AgreementDetailDto> {
  const [row] = await query<AgreementRow>(
    `${SELECT_AGREEMENT} where a.id = $2 and (a.client_id = $1 or a.provider_id = $1)`,
    [user.id, agreementId],
  );
  if (!row) throw notFound("Acuerdo");

  const [rules, decisions, ratings] = await Promise.all([
    row.listing_id && row.rules_version ? loadRules(pool(), row.listing_id, row.rules_version) : [],
    loadDecisions(row.id),
    query<{ id: string; agreement_id: string; rater_id: string; ratee_id: string; ratee_role: "client" | "provider"; score: number; comment: string | null; created_at: Date }>(
      "select id, agreement_id, rater_id, ratee_id, ratee_role, score, comment, created_at from ratings where agreement_id = $1 order by created_at",
      [row.id],
    ),
  ]);

  const ratingDtos: RatingDto[] = ratings.map((rating) => ({
    id: rating.id,
    agreementId: rating.agreement_id,
    raterId: rating.rater_id,
    rateeId: rating.ratee_id,
    rateeRole: rating.ratee_role,
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.created_at.toISOString(),
  }));

  return {
    ...toDto(row, user.id),
    rules,
    decisions,
    ratings: ratingDtos,
    canRate: row.status === "Approved" && !row.i_rated,
  };
}
