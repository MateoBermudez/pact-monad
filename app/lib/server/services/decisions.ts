import "server-only";
import { createHash } from "node:crypto";
import { formatEther, keccak256, toUtf8Bytes } from "ethers";
import { AiUnavailableError, reviewWithAi, type ReviewOutput } from "@/lib/server/ai";
import { readAutoReleaseLimit, readContract, releaseByAgent } from "@/lib/server/chain/contract";
import { syncChain } from "@/lib/server/chain/indexer";
import { pool, query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { ApiError, conflict, notFound } from "@/lib/server/http";
import { withCredits } from "@/lib/server/services/credits";
import { computeRulesHash, loadRules } from "@/lib/server/services/rules";
import { emitWebhook } from "@/lib/server/services/webhooks";
import type {
  CriterionResultDto,
  DecisionDto,
  DecisionKind,
  DecisionVerdict,
  ReleaseCode,
  ReviewOutcomeDto,
} from "@/lib/shared/agreements";
import { trimMon } from "@/lib/shared/money";
import { referencedFileId } from "@/lib/shared/file-reference";
import { getFileInfo } from "@/lib/server/services/files";
import type { FileDto } from "@/lib/shared/files";

// pact-ai acepta como máximo 512 caracteres de "evidencia".
const MAX_EVIDENCE_TEXT = 512;

function describeEvidenceFile(file: FileDto): string {
  return `Archivo adjunto: ${file.fileName} (${file.mimeType}, ${file.sizeBytes} bytes)`.slice(0, MAX_EVIDENCE_TEXT);
}

const DELIVERED_ON_CHAIN = 3;

type AgreementRow = {
  id: string;
  contract_address: string;
  chain_agreement_id: string;
  listing_id: string | null;
  client_id: string;
  client_wallet: string;
  amount_wei: string;
  status: string;
  rules_hash: string | null;
  evidence_url: string | null;
  provider_note: string | null;
  description: string | null;
  rules_version: number | null;
  listing_description: string | null;
};

type DecisionRow = {
  id: string;
  agreement_id: string;
  kind: DecisionKind;
  decided_by: "ai" | "human";
  verdict: DecisionVerdict;
  summary: string;
  criteria_results: CriterionResultDto[];
  rules_version: number | null;
  rules_hash: string | null;
  model: string;
  input_hash: string;
  amount_wei: string;
  limit_wei: string | null;
  decision_hash: string;
  created_at: Date;
  executed: boolean;
};

const DECISION_COLUMNS = `
  d.id, d.agreement_id, d.kind, d.decided_by, d.verdict, d.summary, d.criteria_results, d.rules_version, d.rules_hash,
  d.model, d.input_hash, d.amount_wei::text as amount_wei, d.limit_wei::text as limit_wei, d.decision_hash, d.created_at,
  exists (select 1 from chain_events e
           where e.event = 'AgentReleased' and e.data ->> 'decisionHash' = d.decision_hash) as executed`;

export const toDecisionDto = (row: DecisionRow): DecisionDto => ({
  id: row.id,
  agreementId: row.agreement_id,
  kind: row.kind,
  decidedBy: row.decided_by,
  verdict: row.verdict,
  summary: row.summary,
  criteria: row.criteria_results,
  rulesVersion: row.rules_version,
  rulesHash: row.rules_hash,
  model: row.model,
  inputHash: row.input_hash,
  amountMon: trimMon(formatEther(BigInt(row.amount_wei))),
  limitMon: row.limit_wei === null ? null : trimMon(formatEther(BigInt(row.limit_wei))),
  decisionHash: row.decision_hash,
  createdAt: row.created_at.toISOString(),
  executed: row.executed,
});

export async function loadDecisions(agreementId: string): Promise<DecisionDto[]> {
  const rows = await query<DecisionRow>(
    `select ${DECISION_COLUMNS} from decisions d where d.agreement_id = $1 order by d.created_at, d.id`,
    [agreementId],
  );
  return rows.map(toDecisionDto);
}

async function loadAgreement(agreementId: string, clientId: string): Promise<AgreementRow> {
  const [row] = await query<AgreementRow>(
    `select a.id, a.contract_address, a.chain_agreement_id::text as chain_agreement_id, a.listing_id, a.client_id,
            c.wallet as client_wallet, a.amount_wei::text as amount_wei, a.status, a.rules_hash, a.evidence_url,
            a.provider_note, a.description, l.rules_version, l.description as listing_description
       from agreements a
       join users c on c.id = a.client_id
       left join listings l on l.id = a.listing_id
      where a.id = $1 and a.client_id = $2`,
    [agreementId, clientId],
  );
  if (!row) throw notFound("Acuerdo");
  return row;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// Identifica exactamente lo que se revisó: si el proveedor cambiara la entrega, el hash sería otro.
function inputHashOf(agreement: AgreementRow): string {
  return sha256(
    JSON.stringify({
      contract: agreement.contract_address,
      chainAgreementId: agreement.chain_agreement_id,
      rulesHash: agreement.rules_hash,
      evidenceUrl: agreement.evidence_url,
      providerNote: agreement.provider_note,
    }),
  );
}

// Hash canónico de la decisión: es lo que se ancla on-chain al pagar, y permite comprobar que el registro guardado en
// la base es el mismo que autorizó el pago.
export function computeDecisionHash(input: {
  contract: string;
  chainAgreementId: string;
  rulesHash: string;
  inputHash: string;
  kind: DecisionKind;
  verdict: DecisionVerdict;
  criteria: CriterionResultDto[];
  model: string;
  amountWei: string;
  limitWei: string | null;
}): string {
  return keccak256(
    toUtf8Bytes(
      JSON.stringify({
        v: 1,
        contract: input.contract,
        chainAgreementId: input.chainAgreementId,
        rulesHash: input.rulesHash,
        inputHash: input.inputHash,
        kind: input.kind,
        verdict: input.verdict,
        criteria: input.criteria.map((criterion) => ({
          position: criterion.position,
          met: criterion.met,
          reasoning: criterion.reasoning,
          evidenceExcerpt: criterion.evidenceExcerpt,
        })),
        model: input.model,
        amountWei: input.amountWei,
        limitWei: input.limitWei,
      }),
    ),
  );
}

// El veredicto es estricto: basta una regla sin cumplir para que sea "revisar" y la decisión pase a una persona.
function buildCriteria(rules: { position: number; criterion: string; weight: number }[], ai: ReviewOutput): CriterionResultDto[] {
  const byPosition = new Map(ai.results.map((result) => [result.position, result]));
  return rules.map((rule) => {
    const result = byPosition.get(rule.position);
    return {
      position: rule.position,
      criterion: rule.criterion,
      weight: rule.weight,
      met: result?.met ?? false,
      reasoning: result?.reasoning ?? "La IA no evaluó esta regla; se cuenta como no cumplida.",
      evidenceExcerpt: result?.evidenceExcerpt ?? null,
    };
  });
}

type ReleaseEligibility = { eligible: true; limitWei: bigint } | { eligible: false; code: ReleaseCode; message: string };

async function checkEligibility(agreement: AgreementRow): Promise<ReleaseEligibility> {
  if (!serverEnv.agentPrivateKey) {
    return { eligible: false, code: "agent_not_configured", message: "El agente de IA no está configurado; aprueba tú." };
  }
  const limit = await readAutoReleaseLimit(agreement.client_wallet);
  if (limit === BigInt(0)) {
    return { eligible: false, code: "limit_not_set", message: "No has autorizado a la IA a pagar por ti; aprueba tú." };
  }
  if (BigInt(agreement.amount_wei) > limit) {
    return {
      eligible: false,
      code: "above_limit",
      message: `El monto supera tu límite de ${trimMon(formatEther(limit))} MON; aprueba tú.`,
    };
  }
  return { eligible: true, limitWei: limit };
}

async function insertDecision(
  agreement: AgreementRow,
  fields: {
    kind: DecisionKind;
    verdict: DecisionVerdict;
    summary: string;
    criteria: CriterionResultDto[];
    model: string;
    inputHash: string;
    limitWei: bigint | null;
  },
): Promise<DecisionDto> {
  const decisionHash = computeDecisionHash({
    contract: agreement.contract_address,
    chainAgreementId: agreement.chain_agreement_id,
    rulesHash: agreement.rules_hash ?? "",
    inputHash: fields.inputHash,
    kind: fields.kind,
    verdict: fields.verdict,
    criteria: fields.criteria,
    model: fields.model,
    amountWei: agreement.amount_wei,
    limitWei: fields.limitWei?.toString() ?? null,
  });

  const [row] = await query<DecisionRow>(
    `with inserted as (
       insert into decisions (agreement_id, kind, decided_by, verdict, summary, criteria_results, rules_version, rules_hash,
                              model, input_hash, amount_wei, limit_wei, decision_hash)
       values ($1, $2, 'ai', $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
       returning *)
     select ${DECISION_COLUMNS} from inserted d`,
    [
      agreement.id,
      fields.kind,
      fields.verdict,
      fields.summary,
      JSON.stringify(fields.criteria),
      agreement.rules_version,
      agreement.rules_hash,
      fields.model,
      fields.inputHash,
      agreement.amount_wei,
      fields.limitWei?.toString() ?? null,
      decisionHash,
    ],
  );
  const decision = toDecisionDto(row);
  await emitWebhook(pool(), {
    type: "decision.created",
    recipients: [{ userId: agreement.client_id, role: "client" }],
    data: { agreementId: agreement.id, decisionId: decision.id, verdict: decision.verdict, kind: decision.kind, executed: false },
    dedupe: decision.id,
  });
  return decision;
}

// Paga desde el agente. La decisión ya está guardada: si la transacción falla, el registro queda sin ejecutar y
// la persona puede aprobar ella misma o reintentar.
async function sendRelease(agreement: AgreementRow, decision: DecisionDto): Promise<ReviewOutcomeDto> {
  const onChain: unknown = await readContract().getAgreement(BigInt(agreement.chain_agreement_id));
  const status = (onChain as { status?: unknown }).status;
  if (Number(status) !== DELIVERED_ON_CHAIN) {
    return { decision, released: false, txHash: null, code: "already_settled", message: "Este acuerdo ya no está pendiente de pago." };
  }
  try {
    const txHash = await releaseByAgent(BigInt(agreement.chain_agreement_id), decision.decisionHash);
    await syncChain({ force: true }).catch(() => undefined);
    return { decision: { ...decision, executed: true }, released: true, txHash, code: "released", message: "La IA liberó el pago." };
  } catch (error) {
    console.error("[decisions] fallo al pagar desde el agente:", error);
    return { decision, released: false, txHash: null, code: "release_failed", message: "No se pudo ejecutar el pago; aprueba tú o inténtalo de nuevo." };
  }
}

async function findDecisionForInput(agreementId: string, inputHash: string): Promise<DecisionDto | null> {
  const [row] = await query<DecisionRow>(
    `select ${DECISION_COLUMNS} from decisions d
      where d.agreement_id = $1 and d.input_hash = $2
      order by (d.kind = 'auto_release') desc, d.created_at desc limit 1`,
    [agreementId, inputHash],
  );
  return row ? toDecisionDto(row) : null;
}

// Revisa la entrega contra las reglas confirmadas, deja constancia y, solo si se pide y el contrato lo permite, paga.
// Se puede llamar varias veces con la misma entrega: reutiliza la revisión existente y no vuelve a gastar créditos.
export async function reviewAgreement(args: { agreementId: string; clientId: string; release: boolean }): Promise<ReviewOutcomeDto> {
  const agreement = await loadAgreement(args.agreementId, args.clientId);
  if (agreement.status !== "Delivered") throw conflict("Solo se puede revisar un acuerdo con entrega registrada");
  if (!agreement.listing_id || !agreement.rules_version || !agreement.rules_hash) {
    throw new ApiError(422, "no_rules", "Este acuerdo no tiene reglas confirmadas en PACT; apruébalo tú.");
  }

  const rules = await loadRules(pool(), agreement.listing_id, agreement.rules_version);
  if (computeRulesHash(agreement.listing_id, agreement.rules_version, rules) !== agreement.rules_hash) {
    throw new ApiError(409, "rules_tampered", "Las reglas guardadas no coinciden con las que se fijaron en el acuerdo");
  }

  const inputHash = inputHashOf(agreement);
  const existing = await findDecisionForInput(agreement.id, inputHash);

  if (existing) {
    if (existing.executed) {
      return { decision: existing, released: true, txHash: null, code: "released", message: "La IA ya liberó este pago." };
    }
    if (existing.verdict === "revisar") {
      return { decision: existing, released: false, txHash: null, code: "verdict_revisar", message: "La IA recomienda revisar la entrega antes de pagar." };
    }
    if (!args.release) {
      return { decision: existing, released: false, txHash: null, code: "not_requested", message: "La entrega cumple las reglas." };
    }
    const eligibility = await checkEligibility(agreement);
    if (!eligibility.eligible) return { decision: existing, released: false, txHash: null, code: eligibility.code, message: eligibility.message };

    // Se reutiliza la revisión; si era solo una recomendación, el pago exige su propio registro anclable.
    const toRelease =
      existing.kind === "auto_release"
        ? existing
        : await insertDecision(agreement, {
            kind: "auto_release",
            verdict: existing.verdict,
            summary: existing.summary,
            criteria: existing.criteria,
            model: existing.model,
            inputHash,
            limitWei: eligibility.limitWei,
          });
    return sendRelease(agreement, toRelease);
  }

  const claim = await query("insert into review_runs (agreement_id, input_hash) values ($1, $2) on conflict do nothing returning 1", [
    agreement.id,
    inputHash,
  ]);
  if (claim.length === 0) {
    const reclaimed = await query(
      "update review_runs set status = 'running', created_at = now() where agreement_id = $1 and input_hash = $2 and status = 'failed' returning 1",
      [agreement.id, inputHash],
    );
    if (reclaimed.length === 0) throw conflict("Esta entrega ya se está revisando");
  }
  const releaseClaim = () => query("delete from review_runs where agreement_id = $1 and input_hash = $2", [agreement.id, inputHash]);

  let ai: ReviewOutput;
  try {
    const fileId = referencedFileId(agreement.evidence_url ?? "");
    // La IA no abre la evidencia, solo lee este texto (y pact-ai lo limita a 512 caracteres). Una URL firmada de Storage
    // es larga y caduca, así que de un archivo adjunto se le da su descripción; de un enlace, el enlace recortado.
    const evidenceUrl = fileId
      ? describeEvidenceFile(await getFileInfo(args.clientId, fileId))
      : (agreement.evidence_url ?? "").slice(0, MAX_EVIDENCE_TEXT);
    ai = await withCredits(args.clientId, "review", () =>
      reviewWithAi({
        requirements: agreement.listing_description ?? agreement.description ?? "",
        rules,
        providerNote: agreement.provider_note ?? "",
        evidenceUrl,
      }),
    );
  } catch (error) {
    await releaseClaim();
    if (error instanceof AiUnavailableError) {
      throw new ApiError(502, "ai_unavailable", "La IA no respondió ahora; puedes aprobar tú mismo la entrega.");
    }
    throw error;
  }

  const criteria = buildCriteria(rules, ai);
  const verdict: DecisionVerdict = criteria.every((criterion) => criterion.met) ? "cumple" : "revisar";
  const eligibility = args.release && verdict === "cumple" ? await checkEligibility(agreement) : null;
  const willRelease = eligibility?.eligible === true;

  const decision = await insertDecision(agreement, {
    kind: willRelease ? "auto_release" : "recommendation",
    verdict,
    summary: ai.summary,
    criteria,
    model: ai.model,
    inputHash,
    limitWei: eligibility?.eligible ? eligibility.limitWei : null,
  });
  await query("update review_runs set status = 'done' where agreement_id = $1 and input_hash = $2", [agreement.id, inputHash]);

  if (willRelease) return sendRelease(agreement, decision);
  if (verdict === "revisar") {
    return { decision, released: false, txHash: null, code: "verdict_revisar", message: "La IA recomienda revisar la entrega antes de pagar." };
  }
  if (eligibility && !eligibility.eligible) {
    return { decision, released: false, txHash: null, code: eligibility.code, message: eligibility.message };
  }
  return { decision, released: false, txHash: null, code: "not_requested", message: "La entrega cumple las reglas." };
}
