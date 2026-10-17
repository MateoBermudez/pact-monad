import "server-only";
import { query } from "@/lib/server/db";
import { ApiError, notFound } from "@/lib/server/http";
import { requireOwnedFile } from "@/lib/server/services/files";
import { toPortfolioItem, type PortfolioRow } from "@/lib/server/services/profiles";
import { normalizeKeywords } from "@/lib/shared/keywords";
import type { PortfolioItemDto } from "@/lib/shared/profile";
import type { CreatePortfolioItemInput } from "@/lib/shared/schemas";

export async function listPortfolio(userId: string): Promise<PortfolioItemDto[]> {
  const rows = await query<PortfolioRow>(
    "select * from portfolio_items where user_id = $1 order by created_at desc",
    [userId],
  );
  return rows.map(toPortfolioItem);
}

export async function createPortfolioItem(userId: string, input: CreatePortfolioItemInput): Promise<PortfolioItemDto> {
  if (!input.url && !input.fileId && !input.description) {
    throw new ApiError(400, "empty_item", "Agrega un enlace, un archivo o una descripción");
  }
  if (input.fileId) await requireOwnedFile(userId, input.fileId, "portfolio");

  const [row] = await query<PortfolioRow>(
    `insert into portfolio_items (user_id, title, description, url, file_id, tags)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [userId, input.title, input.description ?? null, input.url ?? null, input.fileId ?? null, normalizeKeywords(input.tags)],
  );
  return toPortfolioItem(row);
}

export async function deletePortfolioItem(userId: string, itemId: string): Promise<void> {
  const deleted = await query<{ id: string }>("delete from portfolio_items where id = $1 and user_id = $2 returning id", [
    itemId,
    userId,
  ]);
  if (deleted.length === 0) throw notFound("Elemento del portafolio");
}
