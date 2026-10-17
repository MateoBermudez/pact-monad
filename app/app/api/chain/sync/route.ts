import { syncChain } from "@/lib/server/chain/indexer";
import { authed } from "@/lib/server/http";

export const POST = authed(async () => {
  const { deliveries, ...summary } = await syncChain({ force: true });
  return { ...summary, deliveries: deliveries.length };
});
