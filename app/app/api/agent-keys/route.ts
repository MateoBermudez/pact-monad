import { authed, readJson, requireWalletSession } from "@/lib/server/http";
import { createAgentKey, listAgentKeys } from "@/lib/server/services/agent-keys";
import { createAgentKeySchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ user }) => ({ keys: await listAgentKeys(user.id) }));

export const POST = authed(async ({ request, user }) => {
  requireWalletSession(user);
  return createAgentKey(user, await readJson(request, createAgentKeySchema));
});
