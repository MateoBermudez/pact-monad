import { authed, parseId } from "@/lib/server/http";
import { enqueuePing } from "@/lib/server/services/webhook-endpoints";
import { runWorker } from "@/lib/server/services/worker";

export const maxDuration = 30;

// Encola un "ping" y lo envía de inmediato para que la persona vea en seguida si su URL responde.
export const POST = authed<{ id: string }>(async ({ params, user }) => {
  const ping = await enqueuePing(user.id, parseId(params.id));
  await runWorker({ budgetMs: 8_000, sync: false });
  return ping;
});
