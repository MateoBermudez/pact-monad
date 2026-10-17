import { authed, parseId } from "@/lib/server/http";
import { getAgreementDetail } from "@/lib/server/services/agreements";
import { syncAndProcess } from "@/lib/server/services/sync";

export const GET = authed<{ id: string }>(async ({ params, user }) => {
  await syncAndProcess().catch(() => undefined);
  return { agreement: await getAgreementDetail(user, parseId(params.id)) };
});
