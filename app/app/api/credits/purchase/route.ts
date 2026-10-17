import { authed, readJson } from "@/lib/server/http";
import { purchaseCredits } from "@/lib/server/services/credits";
import { purchaseCreditsSchema } from "@/lib/shared/schemas";

export const POST = authed(async ({ request, user }) => {
  const { txHash } = await readJson(request, purchaseCreditsSchema);
  return purchaseCredits(user, txHash);
});
