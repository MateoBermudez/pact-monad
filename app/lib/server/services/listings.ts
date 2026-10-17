import "server-only";
import { pool, query, withTransaction, type Queryable } from "@/lib/server/db";
import { ApiError, conflict, forbidden, notFound } from "@/lib/server/http";
import { requireOwnedFile } from "@/lib/server/services/files";
import { loadProfile } from "@/lib/server/services/profiles";
import { computeRulesHash, loadRules, saveRulesVersion } from "@/lib/server/services/rules";
import type { SessionUser } from "@/lib/shared/auth";
import type { ApplicationStatus, ListingDto, ListingStatus } from "@/lib/shared/listings";
import { scoreListingForProvider } from "@/lib/shared/matching";
import { trimMon } from "@/lib/shared/money";
import type { CreateListingInput, SaveRulesInput, UpdateListingInput } from "@/lib/shared/schemas";
import { listListingsQuerySchema } from "@/lib/shared/schemas";
import { normalizeKeywords } from "@/lib/shared/keywords";
import type { z } from "zod";

export const DEFAULT_TITLE = "Solicitud sin título";

export type ListingRow = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  brief_file_id: string | null;
  category: string | null;
  keywords: string[];
  budget_mon: string | null;
  deadline_days: number | null;
  status: ListingStatus;
  rules_version: number;
  rules_hash: string | null;
  rules_confirmed_at: Date | null;
  awarded_application_id: string | null;
  created_at: Date;
  client_name: string | null;
  client_score: number;
  applications_count: number;
};

const SELECT_LISTING = `
  select l.id, l.client_id, l.title, l.description, l.brief_file_id, l.category, l.keywords,
         l.budget_mon::text as budget_mon, l.deadline_days, l.status, l.rules_version, l.rules_hash,
         l.rules_confirmed_at, l.awarded_application_id, l.created_at,
         u.display_name as client_name,
         coalesce(r.client_score, 3.5)::float8 as client_score,
         (select count(*) from applications a where a.listing_id = l.id)::int as applications_count
    from listings l
    join users u on u.id = l.client_id
    left join user_reputation r on r.user_id = l.client_id`;

export async function findListing(db: Queryable, listingId: string): Promise<ListingRow | null> {
  const { rows } = await db.query<ListingRow>(`${SELECT_LISTING} where l.id = $1`, [listingId]);
  return rows[0] ?? null;
}

export async function requireListing(db: Queryable, listingId: string): Promise<ListingRow> {
  const row = await findListing(db, listingId);
  if (!row) throw notFound("Solicitud");
  return row;
}

// Devuelve la solicitud solo si es del usuario; para el resto es como si no existiera.
export async function requireOwnListing(db: Queryable, userId: string, listingId: string): Promise<ListingRow> {
  const row = await requireListing(db, listingId);
  if (row.client_id !== userId) throw row.status === "draft" ? notFound("Solicitud") : forbidden("Esta solicitud no es tuya");
  return row;
}

export function toListingDto(
  row: ListingRow,
  extras: Partial<Pick<ListingDto, "rules" | "match" | "myApplication">> = {},
): ListingDto {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientScore: row.client_score,
    title: row.title,
    description: row.description,
    briefFileId: row.brief_file_id,
    category: row.category,
    keywords: row.keywords,
    budgetMon: row.budget_mon === null ? null : trimMon(row.budget_mon),
    deadlineDays: row.deadline_days,
    status: row.status,
    rulesVersion: row.rules_version,
    rulesHash: row.rules_hash,
    rulesConfirmedAt: row.rules_confirmed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    applicationsCount: row.applications_count,
    rules: extras.rules ?? null,
    match: extras.match ?? null,
    myApplication: extras.myApplication ?? null,
  };
}

async function myApplicationsByListing(
  userId: string,
  listingIds: string[],
): Promise<Map<string, { id: string; status: ApplicationStatus }>> {
  if (listingIds.length === 0) return new Map();
  const rows = await query<{ id: string; listing_id: string; status: ApplicationStatus }>(
    "select id, listing_id, status from applications where provider_id = $1 and listing_id = any($2::uuid[])",
    [userId, listingIds],
  );
  return new Map(rows.map((row) => [row.listing_id, { id: row.id, status: row.status }]));
}

export async function createListing(user: SessionUser, input: CreateListingInput): Promise<ListingDto> {
  if (input.briefFileId) await requireOwnedFile(user.id, input.briefFileId, "brief");

  const [created] = await query<{ id: string }>(
    `insert into listings (client_id, title, description, brief_file_id, category, keywords, budget_mon, deadline_days)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      user.id,
      input.title ?? DEFAULT_TITLE,
      input.description ?? null,
      input.briefFileId ?? null,
      input.category ?? null,
      normalizeKeywords(input.keywords ?? []),
      input.budgetMon?.toString() ?? null,
      input.deadlineDays ?? null,
    ],
  );
  return toListingDto(await requireListing(pool(), created.id), { rules: [] });
}

export async function updateListing(user: SessionUser, listingId: string, input: UpdateListingInput): Promise<ListingDto> {
  const current = await requireOwnListing(pool(), user.id, listingId);
  if (current.status !== "draft") throw conflict("Solo puedes editar una solicitud en borrador");

  await query(
    `update listings
        set title = coalesce($2, title), description = coalesce($3, description),
            budget_mon = coalesce($4::numeric, budget_mon), deadline_days = coalesce($5, deadline_days),
            category = coalesce($6, category), keywords = coalesce($7, keywords)
      where id = $1`,
    [
      listingId,
      input.title ?? null,
      input.description ?? null,
      input.budgetMon?.toString() ?? null,
      input.deadlineDays ?? null,
      input.category ?? null,
      input.keywords ? normalizeKeywords(input.keywords) : null,
    ],
  );
  return getListing(user, listingId);
}

export async function getListing(user: SessionUser, listingId: string): Promise<ListingDto> {
  const row = await requireListing(pool(), listingId);
  const isOwner = row.client_id === user.id;
  if (!isOwner && (row.status === "draft" || row.status === "closed")) throw notFound("Solicitud");

  const [rules, mine] = await Promise.all([
    loadRules(pool(), row.id, row.rules_version),
    myApplicationsByListing(user.id, [row.id]),
  ]);
  return toListingDto(row, { rules, myApplication: mine.get(row.id) ?? null });
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export async function listListings(
  user: SessionUser,
  filters: z.infer<typeof listListingsQuerySchema>,
): Promise<ListingDto[]> {
  if (filters.scope === "mine") {
    const rows = await query<ListingRow>(`${SELECT_LISTING} where l.client_id = $1 order by l.created_at desc limit $2`, [
      user.id,
      filters.limit,
    ]);
    return rows.map((row) => toListingDto(row));
  }

  const pattern = filters.q ? `%${escapeLike(filters.q)}%` : null;
  const [rows, profile] = await Promise.all([
    query<ListingRow>(
      `${SELECT_LISTING}
        where l.status = 'open' and l.client_id <> $1
          and ($2::text is null or l.title ilike $2 or l.description ilike $2)
        order by l.created_at desc limit 200`,
      [user.id, pattern],
    ),
    loadProfile(user.id),
  ]);
  const mine = await myApplicationsByListing(user.id, rows.map((row) => row.id));

  const listings = rows.map((row) => {
    const match = scoreListingForProvider(
      {
        title: row.title,
        category: row.category,
        keywords: row.keywords,
        budgetMon: row.budget_mon === null ? null : Number(row.budget_mon),
        createdAt: row.created_at,
      },
      { keywords: profile.keywords, skills: profile.skills },
      row.client_score,
    );
    return toListingDto(row, { match, myApplication: mine.get(row.id) ?? null });
  });

  if (filters.scope === "recommended") listings.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
  return listings.slice(0, filters.limit);
}

export async function saveRules(user: SessionUser, listingId: string, input: SaveRulesInput): Promise<ListingDto> {
  await withTransaction(async (client) => {
    await client.query("select 1 from listings where id = $1 for update", [listingId]);
    const row = await requireOwnListing(client, user.id, listingId);
    if (row.status !== "draft") throw conflict("Las reglas de una solicitud publicada no se pueden modificar");
    await saveRulesVersion(client, listingId, row.rules_version, input.rules, "human");
  });
  return getListing(user, listingId);
}

export async function publishListing(user: SessionUser, listingId: string): Promise<ListingDto> {
  await withTransaction(async (client) => {
    await client.query("select 1 from listings where id = $1 and client_id = $2 for update", [listingId, user.id]);
    const row = await requireOwnListing(client, user.id, listingId);
    if (row.status !== "draft") throw conflict("La solicitud ya está publicada");
    if (row.title === DEFAULT_TITLE) throw new ApiError(422, "missing_title", "Ponle un título a la solicitud");
    if (row.budget_mon === null || row.deadline_days === null) {
      throw new ApiError(422, "missing_terms", "Define el presupuesto y el plazo antes de publicar");
    }

    const rules = await loadRules(client, listingId, row.rules_version);
    if (rules.length === 0) throw new ApiError(422, "missing_rules", "Revisa y confirma las reglas de aceptación antes de publicar");

    await client.query(
      "update listings set status = 'open', rules_hash = $2, rules_confirmed_at = now() where id = $1",
      [listingId, computeRulesHash(listingId, row.rules_version, rules)],
    );
  });
  return getListing(user, listingId);
}

export async function closeListing(user: SessionUser, listingId: string): Promise<ListingDto> {
  const row = await requireOwnListing(pool(), user.id, listingId);
  if (row.status === "closed") return getListing(user, listingId);
  if (row.status === "awarded") throw conflict("La solicitud ya tiene un proveedor elegido");

  await query("update listings set status = 'closed' where id = $1", [listingId]);
  return getListing(user, listingId);
}
