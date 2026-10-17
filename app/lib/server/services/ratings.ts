import "server-only";
import { query } from "@/lib/server/db";
import { conflict, notFound } from "@/lib/server/http";
import type { SessionUser } from "@/lib/shared/auth";
import type { RatingDto } from "@/lib/shared/agreements";
import type { RateAgreementInput } from "@/lib/shared/schemas";

type RatingRow = {
  id: string;
  agreement_id: string;
  rater_id: string;
  ratee_id: string;
  ratee_role: "client" | "provider";
  score: number;
  comment: string | null;
  created_at: Date;
};

// Califica a la contraparte de un acuerdo aprobado. La base impide calificar acuerdos no aprobados o ajenos,
// y una sola vez por persona y acuerdo.
export async function rateAgreement(user: SessionUser, agreementId: string, input: RateAgreementInput): Promise<RatingDto> {
  const [agreement] = await query<{ client_id: string; provider_id: string }>(
    "select client_id, provider_id from agreements where id = $1 and (client_id = $2 or provider_id = $2)",
    [agreementId, user.id],
  );
  if (!agreement) throw notFound("Acuerdo");

  const [already] = await query<{ id: string }>("select id from ratings where agreement_id = $1 and rater_id = $2", [agreementId, user.id]);
  if (already) throw conflict("Ya calificaste este acuerdo");

  const isClient = agreement.client_id === user.id;
  const [row] = await query<RatingRow>(
    `insert into ratings (agreement_id, rater_id, ratee_id, ratee_role, score, comment)
     values ($1, $2, $3, $4, $5, $6)
     returning id, agreement_id, rater_id, ratee_id, ratee_role, score, comment, created_at`,
    [agreementId, user.id, isClient ? agreement.provider_id : agreement.client_id, isClient ? "provider" : "client", input.score, input.comment ?? null],
  );
  return {
    id: row.id,
    agreementId: row.agreement_id,
    raterId: row.rater_id,
    rateeId: row.ratee_id,
    rateeRole: row.ratee_role,
    score: row.score,
    comment: row.comment,
    createdAt: row.created_at.toISOString(),
  };
}
