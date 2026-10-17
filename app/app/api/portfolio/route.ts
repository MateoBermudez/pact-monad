import { authed, readJson } from "@/lib/server/http";
import { createPortfolioItem, listPortfolio } from "@/lib/server/services/portfolio";
import { createPortfolioItemSchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ user }) => ({ items: await listPortfolio(user.id) }));

export const POST = authed(async ({ request, user }) => ({
  item: await createPortfolioItem(user.id, await readJson(request, createPortfolioItemSchema)),
}));
