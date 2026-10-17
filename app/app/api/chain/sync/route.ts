import { authed } from "@/lib/server/http";
import { syncAndProcess } from "@/lib/server/services/sync";

export const POST = authed(async () => {
  const { deliveries, ...summary } = await syncAndProcess({ force: true });
  return { ...summary, deliveries: deliveries.length };
});
