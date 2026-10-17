import { authed, parseId, readJson } from "@/lib/server/http";
import { reviewAgreement } from "@/lib/server/services/decisions";
import { reviewAgreementSchema } from "@/lib/shared/schemas";

export const POST = authed<{ id: string }>(async ({ request, params, user }) => {
  const { release } = await readJson(request, reviewAgreementSchema);
  return reviewAgreement({ agreementId: parseId(params.id), clientId: user.id, release });
});
