import { authed, parseId, requireWalletSession } from "@/lib/server/http";
import { revokeAgentKey } from "@/lib/server/services/agent-keys";

export const DELETE = authed<{ id: string }>(async ({ params, user }) => {
  requireWalletSession(user);
  return { apiKey: await revokeAgentKey(user.id, parseId(params.id)) };
});
