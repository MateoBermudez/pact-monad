import { authed, parseId } from "@/lib/server/http";
import { deletePortfolioItem } from "@/lib/server/services/portfolio";

export const DELETE = authed<{ id: string }>(async ({ params, user }) => {
  await deletePortfolioItem(user.id, parseId(params.id));
  return { ok: true };
});
