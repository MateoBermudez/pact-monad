import { authed } from "@/lib/server/http";
import { listAgreements } from "@/lib/server/services/agreements";
import { syncAndProcess } from "@/lib/server/services/sync";

export const GET = authed(async ({ user }) => {
  await syncAndProcess().catch(() => undefined);
  return { agreements: await listAgreements(user) };
});
