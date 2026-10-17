import { authed, parseId } from "@/lib/server/http";
import { selectedAgreement } from "@/lib/server/services/applications";
export const GET = authed<{ id: string }>(async ({ params, user }) => ({
  contractCall: await selectedAgreement(user, parseId(params.id)),
}));
