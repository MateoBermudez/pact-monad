import "server-only";
import { z } from "zod";
import { screenApplicantWithAi, type ScreeningOutput } from "@/lib/server/ai";
import { toSessionUser, USER_COLUMNS, type UserRow } from "@/lib/server/auth";
import { pool, query } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { actOnApplication } from "@/lib/server/services/applications";
import { ensureMonthlyGrant, getBalance, withCredits } from "@/lib/server/services/credits";
import { requireListing } from "@/lib/server/services/listings";
import { createNotification } from "@/lib/server/services/notifications";
import { loadPublicProfile } from "@/lib/server/services/profiles";
import { loadRules } from "@/lib/server/services/rules";
import type { SessionUser } from "@/lib/shared/auth";
import { CREDIT_COSTS } from "@/lib/shared/credits";
import type { ScreeningMode } from "@/lib/shared/listings";

const payloadSchema = z.object({ applicationId: z.string().uuid() });

type ApplicationContext = {
  listing_id: string;
  provider_id: string;
  message: string;
  price_mon: string | null;
  days: number | null;
  status: string;
  ai_evaluated_at: Date | null;
  client_id: string;
  listing_status: string;
  mode: ScreeningMode;
  criteria: string | null;
};

const toNumber = (value: string | null) => (value === null ? null : Number(value));

async function loadClient(clientId: string): Promise<SessionUser> {
  const [row] = await query<UserRow>(`select ${USER_COLUMNS} from users where id = $1`, [clientId]);
  return toSessionUser(row, "session");
}

async function evaluate(context: ApplicationContext): Promise<ScreeningOutput> {
  const listing = await requireListing(pool(), context.listing_id);
  const [rules, profile] = await Promise.all([
    loadRules(pool(), listing.id, listing.rules_version),
    loadPublicProfile(context.provider_id),
  ]);
  return withCredits(context.client_id, "screen", () =>
    screenApplicantWithAi({
      listing: {
        title: listing.title,
        description: listing.description ?? "",
        category: listing.category,
        keywords: listing.keywords,
        budgetMon: toNumber(listing.budget_mon),
        deadlineDays: listing.deadline_days,
        rules: rules.map((rule) => rule.criterion),
      },
      applicant: {
        displayName: profile.displayName ?? profile.username ?? "",
        bio: [profile.headline, profile.bio].filter(Boolean).join(". "),
        skills: profile.skills.map((skill) => skill.name),
        keywords: profile.keywords,
        availability: profile.availability,
        providerScore: profile.reputation.providerRatings > 0 ? profile.reputation.providerScore : null,
        completedJobs: profile.reputation.completedAsProvider,
        portfolio: profile.portfolio.map((item) => ({
          title: item.title,
          description: item.description ?? "",
          url: item.url,
        })),
      },
      proposal: { message: context.message, priceMon: toNumber(context.price_mon), days: context.days },
      clientPreferences: context.criteria ?? "",
    }),
  );
}

const isStale = (error: unknown) => error instanceof ApiError && error.status === 409 && error.code === "conflict";

async function shortlist(client: SessionUser, applicationId: string): Promise<void> {
  try {
    await actOnApplication(client, applicationId, "shortlist");
  } catch (error) {
    if (!isStale(error)) throw error;
  }
}

async function chooseOrShortlist(
  client: SessionUser,
  context: ApplicationContext,
  applicationId: string,
  providerName: string,
): Promise<void> {
  try {
    await actOnApplication(client, applicationId, "select");
    const listing = await requireListing(pool(), context.listing_id);
    await createNotification(pool(), {
      userId: client.id,
      type: "application.auto_selected",
      listingId: listing.id,
      title: `Tu IA eligió a ${providerName} para «${listing.title}»`,
      body: "Revisa los términos y firma desde tu wallet para bloquear los fondos.",
      data: { applicationId },
      dedupe: applicationId,
    });
  } catch (error) {
    if (isStale(error)) return;
    if (!(error instanceof ApiError)) throw error;
    await shortlist(client, applicationId);
    const reason =
      error.code === "wallet_required"
        ? "Vincula tu wallet para que tu IA pueda elegir por ti."
        : error.code === "provider_wallet_required"
          ? "Esa persona aún no vincula su wallet, así que la dejamos preseleccionada."
          : error.message;
    await createNotification(pool(), {
      userId: client.id,
      type: "application.received",
      listingId: context.listing_id,
      title: `Tu IA recomienda a ${providerName}, pero no pudo elegirlo`,
      body: reason,
      data: { applicationId },
      dedupe: `blocked:${applicationId}`,
    });
  }
}

async function applyVerdict(
  mode: ScreeningMode,
  context: ApplicationContext,
  applicationId: string,
  output: ScreeningOutput,
  providerName: string,
): Promise<void> {
  const client = await loadClient(context.client_id);
  if (output.verdict === "accept") {
    if (mode === "auto") await chooseOrShortlist(client, context, applicationId, providerName);
    else if (context.status === "submitted") await shortlist(client, applicationId);
    return;
  }
  if (output.verdict === "reject" && mode === "auto") {
    try {
      await actOnApplication(client, applicationId, "reject");
    } catch (error) {
      if (!isStale(error)) throw error;
    }
  }
}

export async function screenApplication(payload: unknown): Promise<void> {
  const { applicationId } = payloadSchema.parse(payload);
  const [context] = await query<ApplicationContext>(
    `select a.listing_id, a.provider_id, a.message, a.price_mon::text as price_mon, a.days, a.status, a.ai_evaluated_at,
            l.client_id, l.status as listing_status,
            coalesce(s.screening_mode, 'assist') as mode, s.screening_criteria as criteria
       from applications a
       join listings l on l.id = a.listing_id
       left join ai_settings s on s.user_id = l.client_id
      where a.id = $1`,
    [applicationId],
  );
  if (!context || context.mode === "off" || context.ai_evaluated_at) return;
  if (context.listing_status !== "open" || !["submitted", "shortlisted"].includes(context.status)) return;

  await ensureMonthlyGrant(context.client_id);
  if ((await getBalance(context.client_id)) < CREDIT_COSTS.screen) return;

  const output = await evaluate(context);
  const saved = await query<{ id: string }>(
    `update applications
        set ai_verdict = $2, ai_score = $3, ai_summary = $4, ai_strengths = $5::text[], ai_concerns = $6::text[],
            ai_evaluated_at = now(), updated_at = now()
      where id = $1 and ai_evaluated_at is null
      returning id`,
    [applicationId, output.verdict, output.score, output.summary, output.strengths, output.concerns],
  );
  if (saved.length === 0) return;

  const profile = await query<{ name: string }>(
    "select coalesce(display_name, username, 'esta persona') as name from users where id = $1",
    [context.provider_id],
  );
  await applyVerdict(context.mode, context, applicationId, output, profile[0]?.name ?? "esta persona");
}
