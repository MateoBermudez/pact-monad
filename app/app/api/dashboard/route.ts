import { authed } from "@/lib/server/http";
import { loadDashboard } from "@/lib/server/services/dashboard";
import { syncAndProcess } from "@/lib/server/services/sync";

export const GET = authed(async ({ user }) => {
  await syncAndProcess().catch(() => undefined);
  return { dashboard: await loadDashboard(user) };
});
