import "server-only";
import { formatEther, parseEther, verifyTypedData } from "ethers";
import type { PoolClient } from "pg";
import { readAmendmentNonce } from "@/lib/server/chain/contract";
import { pool, query, withTransaction } from "@/lib/server/db";
import { ApiError, conflict, forbidden, notFound } from "@/lib/server/http";
import { emitWebhook } from "@/lib/server/services/webhooks";
import type { AgreementRole } from "@/lib/shared/agreements";
import { amendmentTypedData, type AmendmentTerms } from "@/lib/shared/amendment";
import type { SessionUser } from "@/lib/shared/auth";
import { CHAIN_ID } from "@/lib/shared/chain";
import {
  MAX_PROPOSAL_HOURS,
  MESSAGES_PER_MINUTE,
  type ChatDto,
  type MessageDto,
  type MessageKind,
  type PreparedProposalDto,
  type ProposalDto,
  type ProposalExecutionDto,
  type ProposalStatus,
} from "@/lib/shared/chat";
import { trimMon } from "@/lib/shared/money";
import type { AcceptProposalInput, CreateProposalInput, PrepareProposalInput, SendMessageInput } from "@/lib/shared/schemas";
import type { Party } from "@/lib/shared/webhooks";

// Se puede escribir mientras el acuerdo siga vivo; terminado o cancelado queda de solo lectura.
const POSTABLE = new Set(["Created", "Accepted", "Delivered"]);
// Los cambios de precio o plazo solo caben antes de la entrega (así lo exige el contrato).
const AMENDABLE = new Set(["Created", "Accepted"]);
const PREVIEW_LENGTH = 140;

type AgreementRow = {
  id: string;
  chain_agreement_id: string | null;
  contract_address: string;
  client_id: string;
  provider_id: string;
  client_wallet: string | null;
  provider_wallet: string | null;
  amount_wei: string;
  deadline: Date;
  status: string;
};

type ProposalRow = {
  id: string;
  agreement_id: string;
  proposer_id: string;
  old_amount_wei: string;
  new_amount_wei: string;
  new_deadline: Date | null;
  nonce: string;
  expiry: Date;
  proposer_signature: string;
  acceptor_signature: string | null;
  status: Exclude<ProposalStatus, "expired">;
  resolved_at: Date | null;
  applied_tx: string | null;
  created_at: Date;
};

type MessageRow = {
  id: string;
  agreement_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string;
  proposal_id: string | null;
  created_at: Date;
};

const mon = (wei: bigint | string) => trimMon(formatEther(BigInt(wei)));
const unix = (date: Date) => Math.floor(date.getTime() / 1000);
const preview = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
const roleOf = (agreement: AgreementRow, userId: string | null): AgreementRole | null =>
  userId === agreement.client_id ? "client" : userId === agreement.provider_id ? "provider" : null;
const other = (role: AgreementRole): AgreementRole => (role === "client" ? "provider" : "client");

async function loadAgreement(db: Pick<PoolClient, "query">, userId: string, agreementId: string, lock = false): Promise<AgreementRow> {
  const { rows } = await db.query<AgreementRow>(
    `select a.id, a.chain_agreement_id::text as chain_agreement_id, a.contract_address, a.client_id, a.provider_id,
            cu.wallet as client_wallet, pu.wallet as provider_wallet, a.amount_wei::text as amount_wei, a.deadline, a.status
       from agreements a
       join users cu on cu.id = a.client_id
       join users pu on pu.id = a.provider_id
      where a.id = $1 and (a.client_id = $2 or a.provider_id = $2)
      ${lock ? "for update of a" : ""}`,
    [agreementId, userId],
  );
  if (!rows[0]) throw notFound("Acuerdo");
  return rows[0];
}

function requireChainId(agreement: AgreementRow): bigint {
  if (!agreement.chain_agreement_id) throw conflict("Este acuerdo no está registrado en la cadena");
  return BigInt(agreement.chain_agreement_id);
}

function walletOf(agreement: AgreementRow, role: AgreementRole): string {
  const wallet = role === "client" ? agreement.client_wallet : agreement.provider_wallet;
  if (!wallet) throw conflict("Falta la wallet de una de las partes");
  return wallet;
}

function statusOf(row: ProposalRow, now: Date): ProposalStatus {
  return (row.status === "pending" || row.status === "accepted") && row.expiry <= now ? "expired" : row.status;
}

function termsOf(agreement: AgreementRow, row: ProposalRow): AmendmentTerms {
  return {
    id: requireChainId(agreement).toString(),
    newAmount: row.new_amount_wei,
    newDeadline: row.new_deadline ? String(unix(row.new_deadline)) : "0",
    nonce: row.nonce,
    expiry: String(unix(row.expiry)),
  };
}

// Qué hay que hacer para ejecutar una propuesta ya aceptada. El contrato exige que la transacción la envíe una parte y
// la firme la otra; si el importe sube, la envía siempre el cliente porque es quien pone los fondos. La firma de la
// contraparte solo se entrega a quien debe enviarla, y solo después de aceptar: mientras tanto, retirar surte efecto.
function executionOf(agreement: AgreementRow, row: ProposalRow, viewerRole: AgreementRole): ProposalExecutionDto | null {
  const proposerRole = roleOf(agreement, row.proposer_id);
  if (!proposerRole) return null;
  const delta = BigInt(row.new_amount_wei) - BigInt(row.old_amount_wei);

  let executor: AgreementRole;
  let signature: string | null;
  if (delta > BigInt(0)) {
    executor = "client";
    signature = proposerRole === "provider" ? row.proposer_signature : row.acceptor_signature;
  } else {
    executor = other(proposerRole);
    signature = row.proposer_signature;
  }
  if (!signature || viewerRole !== executor) return null;
  return {
    executor,
    youExecute: true,
    terms: termsOf(agreement, row),
    signature,
    valueWei: delta > BigInt(0) ? delta.toString() : "0",
    refundWei: delta < BigInt(0) ? (-delta).toString() : "0",
  };
}

function toProposalDto(agreement: AgreementRow, row: ProposalRow, viewerId: string, now: Date): ProposalDto {
  const viewerRole = roleOf(agreement, viewerId) ?? "client";
  const proposerRole = roleOf(agreement, row.proposer_id) ?? "client";
  const status = statusOf(row, now);
  const mine = row.proposer_id === viewerId;
  const delta = BigInt(row.new_amount_wei) - BigInt(row.old_amount_wei);
  // Subida que propuso el cliente: el proveedor solo firma, y luego el cliente envía los fondos.
  const acceptMeansSigning = status === "pending" && delta > BigInt(0) && proposerRole === "client";
  const execution = status === "accepted" ? executionOf(agreement, row, viewerRole) : null;

  return {
    id: row.id,
    agreementId: row.agreement_id,
    proposerId: row.proposer_id,
    proposerRole,
    proposedByMe: mine,
    oldAmountMon: mon(row.old_amount_wei),
    newAmountMon: mon(row.new_amount_wei),
    deltaMon: trimMon(formatEther(delta)),
    newDeadline: row.new_deadline?.toISOString() ?? null,
    expiresAt: row.expiry.toISOString(),
    terms: termsOf(agreement, row),
    status,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    appliedTx: row.applied_tx,
    canAccept: status === "pending" && !mine,
    canReject: status === "pending" && !mine,
    canWithdraw: status === "pending" && mine,
    canRevokeOnChain: status === "accepted",
    acceptMeansSigning,
    execution,
  };
}

async function loadProposals(db: Pick<PoolClient, "query">, ids: string[]): Promise<Map<string, ProposalRow>> {
  if (ids.length === 0) return new Map();
  const { rows } = await db.query<ProposalRow>(
    `select id, agreement_id, proposer_id, old_amount_wei::text, new_amount_wei::text, new_deadline, nonce::text, expiry,
            proposer_signature, acceptor_signature, status, resolved_at, applied_tx, created_at
       from agreement_proposals where id = any($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

async function toMessageDtos(agreement: AgreementRow, rows: MessageRow[], viewerId: string): Promise<MessageDto[]> {
  const proposals = await loadProposals(
    pool(),
    rows.flatMap((row) => (row.proposal_id ? [row.proposal_id] : [])),
  );
  const now = new Date();
  return rows.map((row) => {
    const proposal = row.proposal_id ? proposals.get(row.proposal_id) : undefined;
    return {
      id: row.id,
      agreementId: row.agreement_id,
      kind: row.kind,
      senderId: row.sender_id,
      senderRole: roleOf(agreement, row.sender_id),
      mine: row.sender_id === viewerId,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      proposal: proposal ? toProposalDto(agreement, proposal, viewerId, now) : null,
    };
  });
}

export async function listChat(user: SessionUser, agreementId: string): Promise<ChatDto> {
  const agreement = await loadAgreement(pool(), user.id, agreementId);
  const rows = await query<MessageRow>(
    `select id, agreement_id, sender_id, kind, body, proposal_id, created_at
       from (select * from agreement_messages where agreement_id = $1 order by created_at desc, id desc limit 300) recent
      order by created_at, id`,
    [agreementId],
  );
  return {
    messages: await toMessageDtos(agreement, rows, user.id),
    canPost: POSTABLE.has(agreement.status),
    canPropose: AMENDABLE.has(agreement.status) && agreement.chain_agreement_id !== null,
  };
}

async function insertMessage(
  client: PoolClient,
  agreementId: string,
  senderId: string | null,
  kind: MessageKind,
  body: string,
  proposalId: string | null = null,
): Promise<MessageRow> {
  const { rows } = await client.query<MessageRow>(
    `insert into agreement_messages (agreement_id, sender_id, kind, body, proposal_id) values ($1, $2, $3, $4, $5)
     returning id, agreement_id, sender_id, kind, body, proposal_id, created_at`,
    [agreementId, senderId, kind, body, proposalId],
  );
  return rows[0];
}

const recipientsOf = (agreement: AgreementRow, role: Party) => [
  { userId: role === "client" ? agreement.client_id : agreement.provider_id, role },
];

export async function sendMessage(user: SessionUser, agreementId: string, input: SendMessageInput): Promise<MessageDto> {
  const agreement = await loadAgreement(pool(), user.id, agreementId);
  if (!POSTABLE.has(agreement.status)) throw conflict("Este acuerdo ya terminó: el chat quedó de solo lectura");

  const [recent] = await query<{ total: string }>(
    "select count(*)::text as total from agreement_messages where sender_id = $1 and created_at > now() - interval '1 minute'",
    [user.id],
  );
  if (Number(recent.total) >= MESSAGES_PER_MINUTE) {
    throw new ApiError(429, "rate_limited", "Estás enviando mensajes muy rápido. Espera un momento");
  }

  const row = await withTransaction(async (client) => {
    const message = await insertMessage(client, agreementId, user.id, "text", input.body);
    const senderRole = roleOf(agreement, user.id) ?? "client";
    await emitWebhook(client, {
      type: "agreement.message",
      recipients: recipientsOf(agreement, other(senderRole)),
      dedupe: message.id,
      data: { agreementId, messageId: message.id, senderRole, preview: preview(input.body) },
    });
    return message;
  });
  return (await toMessageDtos(agreement, [row], user.id))[0];
}

// Convierte lo que escribió la persona en los términos exactos que se firman y se ejecutan on-chain.
function buildTerms(agreement: AgreementRow, input: PrepareProposalInput, nonce: bigint, expiry: number): AmendmentTerms {
  const newAmount = input.newAmountMon === undefined ? BigInt(agreement.amount_wei) : parseEther(input.newAmountMon.toFixed(6));
  const newDeadline = input.newDeadline ? Math.floor(new Date(input.newDeadline).getTime() / 1000) : 0;
  if (newDeadline !== 0 && newDeadline <= Math.floor(Date.now() / 1000)) throw conflict("El nuevo plazo debe estar en el futuro");
  if (newAmount === BigInt(agreement.amount_wei) && newDeadline === 0) throw conflict("La propuesta no cambia nada");
  return {
    id: requireChainId(agreement).toString(),
    newAmount: newAmount.toString(),
    newDeadline: String(newDeadline),
    nonce: nonce.toString(),
    expiry: String(expiry),
  };
}

function requireAmendable(agreement: AgreementRow): void {
  if (!AMENDABLE.has(agreement.status)) throw conflict("Solo se puede renegociar antes de que haya una entrega");
  requireChainId(agreement);
}

// Paso 1: el servidor lee el nonce vigente del contrato y devuelve lo que la persona debe firmar con su wallet.
export async function prepareProposal(user: SessionUser, agreementId: string, input: PrepareProposalInput): Promise<PreparedProposalDto> {
  const agreement = await loadAgreement(pool(), user.id, agreementId);
  requireAmendable(agreement);
  const nonce = await readAmendmentNonce(requireChainId(agreement));
  const expiry = Math.floor(Date.now() / 1000) + Math.min(input.expiresInHours, MAX_PROPOSAL_HOURS) * 3600;
  const terms = buildTerms(agreement, input, nonce, expiry);
  return {
    typedData: amendmentTypedData({ chainId: CHAIN_ID, contract: agreement.contract_address, terms }),
    expiresAt: new Date(expiry * 1000).toISOString(),
  };
}

function recoverSigner(agreement: AgreementRow, terms: AmendmentTerms, signature: string): string {
  const typed = amendmentTypedData({ chainId: CHAIN_ID, contract: agreement.contract_address, terms });
  try {
    return verifyTypedData(typed.domain, typed.types, typed.message, signature).toLowerCase();
  } catch {
    throw new ApiError(422, "invalid_signature", "La firma no es válida");
  }
}

function summarize(oldWei: string, newWei: string, deadline: Date | null): string {
  const parts: string[] = [];
  if (oldWei !== newWei) parts.push(`precio ${mon(oldWei)} → ${mon(newWei)} MON`);
  if (deadline) parts.push(`plazo hasta el ${deadline.toISOString().slice(0, 10)}`);
  return `Propone cambiar: ${parts.join(" y ")}.`;
}

// Paso 2: guarda la propuesta firmada. Una propuesta nueva reemplaza a la vigente (así funciona la contraoferta).
export async function createProposal(user: SessionUser, agreementId: string, input: CreateProposalInput): Promise<MessageDto> {
  const initial = await loadAgreement(pool(), user.id, agreementId);
  requireAmendable(initial);
  const chainNonce = await readAmendmentNonce(requireChainId(initial));
  if (BigInt(input.nonce) !== chainNonce) throw conflict("El acuerdo cambió mientras firmabas. Vuelve a proponer");

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (input.expiry <= nowSeconds) throw conflict("La propuesta ya venció");
  if (input.expiry > nowSeconds + MAX_PROPOSAL_HOURS * 3600 + 300) throw conflict("La vigencia máxima es de 7 días");

  const message = await withTransaction(async (client) => {
    const agreement = await loadAgreement(client, user.id, agreementId, true);
    requireAmendable(agreement);
    const proposerRole = roleOf(agreement, user.id) ?? "client";

    const terms = buildTerms(agreement, input, chainNonce, input.expiry);
    if (recoverSigner(agreement, terms, input.signature) !== walletOf(agreement, proposerRole).toLowerCase()) {
      throw new ApiError(422, "invalid_signature", "La firma no corresponde a tu wallet");
    }

    await client.query(
      `update agreement_proposals set status = 'superseded', resolved_by = $2, resolved_at = now()
        where agreement_id = $1 and status in ('pending', 'accepted')`,
      [agreementId, user.id],
    );
    const { rows } = await client.query<{ id: string; new_deadline: Date | null }>(
      `insert into agreement_proposals (agreement_id, proposer_id, old_amount_wei, new_amount_wei, new_deadline, nonce, expiry, proposer_signature)
       values ($1, $2, $3, $4, case when $5::bigint = 0 then null else to_timestamp($5::bigint) end, $6, to_timestamp($7), $8)
       returning id, new_deadline`,
      [agreementId, user.id, agreement.amount_wei, terms.newAmount, terms.newDeadline, terms.nonce, input.expiry, input.signature],
    );
    const proposalId = rows[0].id;
    const body = input.note ? `${input.note}\n\n${summarize(agreement.amount_wei, terms.newAmount, rows[0].new_deadline)}` : summarize(agreement.amount_wei, terms.newAmount, rows[0].new_deadline);
    const created = await insertMessage(client, agreementId, user.id, "proposal", body, proposalId);

    await emitWebhook(client, {
      type: "proposal.created",
      recipients: recipientsOf(agreement, other(proposerRole)),
      dedupe: proposalId,
      data: {
        agreementId,
        proposalId,
        proposerRole,
        oldAmountMon: mon(agreement.amount_wei),
        newAmountMon: mon(terms.newAmount),
        newDeadline: rows[0].new_deadline?.toISOString() ?? null,
        expiresAt: new Date(input.expiry * 1000).toISOString(),
      },
    });
    return created;
  });
  return (await toMessageDtos(initial, [message], user.id))[0];
}

async function loadLiveProposal(client: PoolClient, agreementId: string, proposalId: string): Promise<ProposalRow> {
  const { rows } = await client.query<ProposalRow>(
    `select id, agreement_id, proposer_id, old_amount_wei::text, new_amount_wei::text, new_deadline, nonce::text, expiry,
            proposer_signature, acceptor_signature, status, resolved_at, applied_tx, created_at
       from agreement_proposals where id = $1 and agreement_id = $2 for update`,
    [proposalId, agreementId],
  );
  if (!rows[0]) throw notFound("Propuesta");
  return rows[0];
}

// Rechazar o retirar cierra la propuesta; la contraoferta es simplemente una propuesta nueva.
export async function resolveProposal(user: SessionUser, agreementId: string, proposalId: string, action: "reject" | "withdraw"): Promise<MessageDto> {
  const initial = await loadAgreement(pool(), user.id, agreementId);
  const message = await withTransaction(async (client) => {
    const agreement = await loadAgreement(client, user.id, agreementId, true);
    const proposal = await loadLiveProposal(client, agreementId, proposalId);
    const now = new Date();
    const status = statusOf(proposal, now);
    const mine = proposal.proposer_id === user.id;

    if (action === "reject") {
      if (mine) throw forbidden("Tú hiciste esta propuesta: puedes retirarla");
      if (status !== "pending") throw conflict("Esta propuesta ya no está pendiente");
    } else {
      if (!mine) throw forbidden("Solo quien propuso puede retirarla");
      if (status !== "pending") {
        throw conflict(
          status === "accepted"
            ? "La otra parte ya aceptó: para anularla revoca las firmas en la cadena"
            : "Esta propuesta ya no está vigente",
        );
      }
    }

    const next = action === "reject" ? "rejected" : "withdrawn";
    await client.query("update agreement_proposals set status = $2, resolved_by = $3, resolved_at = now() where id = $1", [proposalId, next, user.id]);
    const role = roleOf(agreement, user.id) ?? "client";
    const note = await insertMessage(
      client,
      agreementId,
      null,
      "system",
      action === "reject"
        ? `El ${role === "client" ? "cliente" : "proveedor"} rechazó la propuesta de ${mon(proposal.new_amount_wei)} MON.`
        : `El ${role === "client" ? "cliente" : "proveedor"} retiró su propuesta de ${mon(proposal.new_amount_wei)} MON.`,
    );
    if (action === "reject") {
      await emitWebhook(client, {
        type: "proposal.rejected",
        recipients: recipientsOf(agreement, other(role)),
        dedupe: proposalId,
        data: { agreementId, proposalId },
      });
    }
    return note;
  });
  return (await toMessageDtos(initial, [message], user.id))[0];
}

// Aceptar libera la firma de quien propuso a quien debe enviar la transacción. Si el cliente propuso subir el precio,
// el proveedor además firma (sin gas) y es el cliente quien envía los fondos extra.
export async function acceptProposal(user: SessionUser, agreementId: string, proposalId: string, input: AcceptProposalInput): Promise<MessageDto> {
  const initial = await loadAgreement(pool(), user.id, agreementId);
  const chainNonce = await readAmendmentNonce(requireChainId(initial));

  const message = await withTransaction(async (client) => {
    const agreement = await loadAgreement(client, user.id, agreementId, true);
    requireAmendable(agreement);
    const proposal = await loadLiveProposal(client, agreementId, proposalId);
    if (statusOf(proposal, new Date()) !== "pending") throw conflict("Esta propuesta ya no está pendiente");
    if (proposal.proposer_id === user.id) throw forbidden("No puedes aceptar tu propia propuesta");
    if (BigInt(proposal.nonce) !== chainNonce) throw conflict("El acuerdo cambió: pídele a la otra parte que vuelva a proponer");

    const proposerRole = roleOf(agreement, proposal.proposer_id) ?? "client";
    const accepterRole = other(proposerRole);
    const delta = BigInt(proposal.new_amount_wei) - BigInt(proposal.old_amount_wei);
    const clientRaises = delta > BigInt(0) && proposerRole === "client";
    const executor: AgreementRole = delta > BigInt(0) ? "client" : accepterRole;

    let acceptorSignature: string | null = null;
    if (clientRaises) {
      if (!input.signature) throw new ApiError(422, "signature_required", "Firma el cambio con tu wallet para aceptarlo");
      if (recoverSigner(agreement, termsOf(agreement, proposal), input.signature) !== walletOf(agreement, "provider").toLowerCase()) {
        throw new ApiError(422, "invalid_signature", "La firma no corresponde a tu wallet");
      }
      acceptorSignature = input.signature;
    }

    await client.query("update agreement_proposals set status = 'accepted', acceptor_signature = $2, resolved_by = $3 where id = $1", [
      proposalId,
      acceptorSignature,
      user.id,
    ]);
    const who = accepterRole === "client" ? "cliente" : "proveedor";
    const text = clientRaises
      ? `El proveedor aceptó el nuevo precio de ${mon(proposal.new_amount_wei)} MON. Falta que el cliente envíe ${mon(delta)} MON adicionales al contrato.`
      : delta > BigInt(0)
        ? `El cliente aceptó el nuevo precio de ${mon(proposal.new_amount_wei)} MON y enviará ${mon(delta)} MON adicionales al contrato.`
        : `El ${who} aceptó el cambio a ${mon(proposal.new_amount_wei)} MON. Al aplicarse, ${mon(-delta)} MON vuelven al cliente.`;
    const note = await insertMessage(client, agreementId, null, "system", text);
    await emitWebhook(client, {
      type: "proposal.accepted",
      recipients: recipientsOf(agreement, proposerRole),
      dedupe: proposalId,
      data: { agreementId, proposalId, newAmountMon: mon(proposal.new_amount_wei), deltaMon: trimMon(formatEther(delta)), executor },
    });
    return note;
  });
  return (await toMessageDtos(initial, [message], user.id))[0];
}
