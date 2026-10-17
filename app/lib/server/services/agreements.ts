import "server-only";
import { query } from "@/lib/server/db";
import { notFound } from "@/lib/server/http";
import type { AgreementDto, AgreementStatusName } from "@/lib/shared/pact";

type AgreementRow = {
  id: string;
  chain_agreement_id: string;
  contract_address: string;
  listing_id: string | null;
  amount_wei: string;
  deadline: Date;
  status: AgreementStatusName;
  rules_hash: string | null;
  description: string | null;
  evidence_url: string | null;
  provider_note: string | null;
  create_tx: string | null;
  created_at: Date;
  client_id: string;
  client_username: string | null;
  client_display_name: string | null;
  client_wallet: string | null;
  provider_id: string;
  provider_username: string | null;
  provider_display_name: string | null;
  provider_wallet: string | null;
};

const SELECT_AGREEMENT = `
  select g.id, g.chain_agreement_id::text as chain_agreement_id, g.contract_address, g.listing_id,
         g.amount_wei::text as amount_wei, g.deadline, g.status, g.rules_hash, g.description, g.evidence_url,
         g.provider_note, g.create_tx, g.created_at,
         c.id as client_id, c.username as client_username, c.display_name as client_display_name, c.wallet as client_wallet,
         p.id as provider_id, p.username as provider_username, p.display_name as provider_display_name, p.wallet as provider_wallet
    from agreements g
    join users c on c.id = g.client_id
    join users p on p.id = g.provider_id`;

const toDto = (row: AgreementRow): AgreementDto => ({
  id: row.id,
  chainAgreementId: row.chain_agreement_id,
  contractAddress: row.contract_address,
  listingId: row.listing_id,
  createdById: row.client_id,
  createdByUsername: row.client_username,
  client: {
    id: row.client_id,
    username: row.client_username,
    displayName: row.client_display_name,
    wallet: row.client_wallet,
  },
  provider: {
    id: row.provider_id,
    username: row.provider_username,
    displayName: row.provider_display_name,
    wallet: row.provider_wallet,
  },
  amountWei: row.amount_wei,
  deadline: row.deadline.toISOString(),
  status: row.status,
  rulesHash: row.rules_hash,
  description: row.description,
  evidenceUrl: row.evidence_url,
  providerNote: row.provider_note,
  createTx: row.create_tx,
  createdAt: row.created_at.toISOString(),
});

export async function listAgreementsFor(userId: string): Promise<AgreementDto[]> {
  const rows = await query<AgreementRow>(
    `${SELECT_AGREEMENT} where g.client_id = $1 or g.provider_id = $1 order by g.created_at desc`,
    [userId],
  );
  return rows.map(toDto);
}

export async function getAgreementFor(userId: string, agreementId: string): Promise<AgreementDto> {
  const [row] = await query<AgreementRow>(
    `${SELECT_AGREEMENT} where g.id = $2 and (g.client_id = $1 or g.provider_id = $1)`,
    [userId, agreementId],
  );
  if (!row) throw notFound("Acuerdo");
  return toDto(row);
}
