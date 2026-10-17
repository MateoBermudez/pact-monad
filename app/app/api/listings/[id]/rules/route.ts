import { authed, parseId, readJson } from "@/lib/server/http";
import { getListing, saveRules } from "@/lib/server/services/listings";
import { saveRulesSchema } from "@/lib/shared/schemas";

export const GET = authed<{ id: string }>(async ({ params, user }) => {
  const listing = await getListing(user, parseId(params.id));
  return { version: listing.rulesVersion, rulesHash: listing.rulesHash, rules: listing.rules ?? [] };
});

export const PUT = authed<{ id: string }>(async ({ request, params, user }) => {
  const listing = await saveRules(user, parseId(params.id), await readJson(request, saveRulesSchema));
  return { version: listing.rulesVersion, rulesHash: listing.rulesHash, rules: listing.rules ?? [] };
});
