import { authed, parseId } from "@/lib/server/http";
import { getAgreementFor } from "@/lib/server/services/agreements";

export const GET = authed<{ id: string }>(async ({ params, user }) => ({
  agreement: await getAgreementFor(user.id, parseId(params.id)),
}));
