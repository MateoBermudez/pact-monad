import { authed, parseId, readJson } from "@/lib/server/http";
import { rateAgreement } from "@/lib/server/services/ratings";
import { rateAgreementSchema } from "@/lib/shared/schemas";

export const POST = authed<{ id: string }>(async ({ request, params, user }) => ({
  rating: await rateAgreement(user, parseId(params.id), await readJson(request, rateAgreementSchema)),
}));
