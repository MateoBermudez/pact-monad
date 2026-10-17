import "server-only";
import type { Queryable } from "@/lib/server/db";
import { query } from "@/lib/server/db";
import { loadProviderSummaries } from "@/lib/server/services/profiles";
import { emitWebhook } from "@/lib/server/services/webhooks";
import { isRelevantListing, scoreListingForProvider } from "@/lib/shared/matching";
import { trimMon } from "@/lib/shared/money";
import {
  MAX_NOTIFICATIONS_PER_LISTING,
  type NotificationDto,
  type NotificationsResponse,
} from "@/lib/shared/notifications";

const CANDIDATE_LIMIT = 500;
const PREVIEW_LENGTH = 140;
const WHITESPACE = new RegExp(String.raw`\s+`, "g");

type NotificationRow = {
  id: string;
  type: NotificationDto["type"];
  title: string;
  body: string | null;
  listing_id: string | null;
  data: Record<string, unknown>;
  created_at: Date;
  read_at: Date | null;
};

export type PublishedListing = {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  category: string | null;
  keywords: string[];
  budgetMon: string | null;
  clientScore: number;
  createdAt: Date;
};

const toDto = (row: NotificationRow): NotificationDto => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  listingId: row.listing_id,
  data: row.data,
  createdAt: row.created_at.toISOString(),
  readAt: row.read_at?.toISOString() ?? null,
});

const preview = (text: string | null) => (text ? text.replace(WHITESPACE, " ").trim().slice(0, PREVIEW_LENGTH) : null);

export async function notifyMatchingProviders(db: Queryable, listing: PublishedListing): Promise<number> {
  const candidates = await query<{ id: string }>(
    `select u.id from users u
      where u.id <> $1 and 'provider' = any(u.roles) and u.availability <> 'unavailable'
        and (cardinality(u.keywords) > 0 or exists (select 1 from user_skills us where us.user_id = u.id))
      limit ${CANDIDATE_LIMIT}`,
    [listing.clientId],
  );
  const providers = await loadProviderSummaries(candidates.map((row) => row.id));

  const matches = [...providers.values()]
    .map((provider) => ({ id: provider.id, profile: { keywords: provider.keywords, skills: provider.skills } }))
    .filter(({ profile }) => isRelevantListing(listing, profile))
    .map(({ id, profile }) => ({
      userId: id,
      match: scoreListingForProvider(
        {
          title: listing.title,
          category: listing.category,
          keywords: listing.keywords,
          budgetMon: listing.budgetMon === null ? null : Number(listing.budgetMon),
          createdAt: listing.createdAt,
        },
        profile,
        listing.clientScore,
      ),
    }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, MAX_NOTIFICATIONS_PER_LISTING);

  const budget = listing.budgetMon === null ? null : trimMon(listing.budgetMon);
  for (const { userId, match } of matches) {
    await db.query(
      `insert into notifications (user_id, type, listing_id, title, body, data, dedupe_key)
       values ($1, 'listing.matched', $2, $3, $4, $5::jsonb, $6)
       on conflict (user_id, dedupe_key) do nothing`,
      [
        userId,
        listing.id,
        `Nueva solicitud para ti: ${listing.title}`,
        preview(listing.description),
        JSON.stringify({ score: match.score, reasons: match.reasons, budgetMon: budget, category: listing.category }),
        `listing.matched:${listing.id}`,
      ],
    );
    await emitWebhook(db, {
      type: "listing.matched",
      recipients: [{ userId, role: "provider" }],
      data: {
        listingId: listing.id,
        title: listing.title,
        category: listing.category,
        budgetMon: budget,
        score: match.score,
        reasons: match.reasons,
      },
      dedupe: listing.id,
    });
  }
  return matches.length;
}

export type NewNotification = {
  userId: string;
  type: NotificationDto["type"];
  listingId: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  dedupe: string;
};

export async function createNotification(db: Queryable, input: NewNotification): Promise<void> {
  await db.query(
    `insert into notifications (user_id, type, listing_id, title, body, data, dedupe_key)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7)
     on conflict (user_id, dedupe_key) do nothing`,
    [
      input.userId,
      input.type,
      input.listingId,
      input.title,
      input.body ?? null,
      JSON.stringify(input.data ?? {}),
      `${input.type}:${input.dedupe}`,
    ],
  );
}

export async function listNotifications(userId: string, limit: number): Promise<NotificationsResponse> {
  const [rows, [count]] = await Promise.all([
    query<NotificationRow>(
      `select id::text as id, type, title, body, listing_id, data, created_at, read_at
         from notifications where user_id = $1 order by id desc limit $2`,
      [userId, limit],
    ),
    query<{ unread: number }>("select count(*)::int as unread from notifications where user_id = $1 and read_at is null", [
      userId,
    ]),
  ]);
  return { notifications: rows.map(toDto), unread: count.unread };
}

export async function markNotificationsRead(userId: string, ids?: number[]): Promise<number> {
  const rows = await query<{ id: string }>(
    `update notifications set read_at = now()
      where user_id = $1 and read_at is null and ($2::bigint[] is null or id = any($2::bigint[]))
      returning id`,
    [userId, ids && ids.length > 0 ? ids : null],
  );
  return rows.length;
}
