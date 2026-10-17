import "server-only";
import { query, withTransaction } from "@/lib/server/db";
import { ApiError, notFound } from "@/lib/server/http";
import { normalizeKeywords } from "@/lib/shared/keywords";
import type {
  Availability,
  PortfolioItemDto,
  ProfileDto,
  ProfileLinkDto,
  ProviderSummaryDto,
  PublicProfileDto,
  ReputationDto,
  SkillDto,
  UserSkillDto,
} from "@/lib/shared/profile";
import type { UpdateProfileInput } from "@/lib/shared/schemas";

const PROFILE_COLUMNS =
  "id, username, avatar_url, location, availability, links, wallet, display_name, headline, bio, keywords, is_agent";

type UserRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  availability: Availability;
  links: ProfileLinkDto[];
  wallet: string | null;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  keywords: string[];
  is_agent: boolean;
};

export type ReputationRow = {
  provider_ratings: string;
  provider_avg: string | null;
  provider_score: string;
  client_ratings: string;
  client_score: string;
  completed_as_provider: string;
};

export type PortfolioRow = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  file_id: string | null;
  tags: string[];
  created_at: Date;
};

export const toReputation = (row: ReputationRow | undefined): ReputationDto => ({
  providerRatings: Number(row?.provider_ratings ?? 0),
  providerAverage: row?.provider_avg == null ? null : Number(row.provider_avg),
  providerScore: Number(row?.provider_score ?? 3.5),
  clientRatings: Number(row?.client_ratings ?? 0),
  clientScore: Number(row?.client_score ?? 3.5),
  completedAsProvider: Number(row?.completed_as_provider ?? 0),
});

export const toPortfolioItem = (row: PortfolioRow): PortfolioItemDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  url: row.url,
  fileId: row.file_id,
  tags: row.tags,
  createdAt: row.created_at.toISOString(),
});

export async function listSkills(): Promise<SkillDto[]> {
  return query<SkillDto>("select slug, name, category from skills order by category, name");
}

export async function loadProfile(userId: string): Promise<ProfileDto> {
  const [user] = await query<UserRow>(
    `select ${PROFILE_COLUMNS} from users where id = $1`,
    [userId],
  );
  if (!user) throw notFound("Usuario");

  const [skills, [reputation]] = await Promise.all([
    query<UserSkillDto>(
      `select s.slug, s.name, s.category, us.level
         from user_skills us join skills s on s.id = us.skill_id
        where us.user_id = $1 order by us.level desc, s.name`,
      [userId],
    ),
    query<ReputationRow>("select * from user_reputation where user_id = $1", [userId]),
  ]);

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url,
    location: user.location,
    availability: user.availability,
    links: user.links,
    wallet: user.wallet,
    displayName: user.display_name,
    headline: user.headline,
    bio: user.bio,
    keywords: user.keywords,
    isAgent: user.is_agent,
    skills,
    reputation: toReputation(reputation),
  };
}

export async function loadPublicProfile(userId: string): Promise<PublicProfileDto> {
  const [profile, portfolio] = await Promise.all([
    loadProfile(userId),
    query<PortfolioRow>("select * from portfolio_items where user_id = $1 order by created_at desc", [userId]),
  ]);
  return { ...profile, portfolio: portfolio.map(toPortfolioItem) };
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileDto> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `select ${PROFILE_COLUMNS} from users where id = $1 for update`,
      [userId],
    );
    const current = rows[0];
    if (!current) throw notFound("Usuario");

    await client.query(
      `update users set display_name = $2, headline = $3, bio = $4, keywords = $5, is_agent = $6,
                        avatar_url = $7, location = $8, availability = $9, links = $10::jsonb
        where id = $1`,
      [
        userId,
        input.displayName === undefined ? current.display_name : input.displayName,
        input.headline === undefined ? current.headline : input.headline,
        input.bio === undefined ? current.bio : input.bio,
        input.keywords === undefined ? current.keywords : normalizeKeywords(input.keywords),
        input.isAgent === undefined ? current.is_agent : input.isAgent,
        input.avatarUrl === undefined ? current.avatar_url : input.avatarUrl,
        input.location === undefined ? current.location : input.location,
        input.availability === undefined ? current.availability : input.availability,
        JSON.stringify(input.links === undefined ? current.links : input.links),
      ],
    );

    if (input.skills) {
      const slugs = [...new Set(input.skills.map((skill) => skill.slug))];
      const { rows: known } = await client.query<{ id: number; slug: string }>(
        "select id, slug from skills where slug = any($1::text[])",
        [slugs],
      );
      const idBySlug = new Map(known.map((skill) => [skill.slug, skill.id]));
      const unknown = slugs.filter((slug) => !idBySlug.has(slug));
      if (unknown.length > 0) throw new ApiError(400, "unknown_skill", `Habilidades desconocidas: ${unknown.join(", ")}`);

      await client.query("delete from user_skills where user_id = $1", [userId]);
      for (const skill of input.skills) {
        await client.query(
          "insert into user_skills (user_id, skill_id, level) values ($1, $2, $3) on conflict (user_id, skill_id) do update set level = excluded.level",
          [userId, idBySlug.get(skill.slug), skill.level],
        );
      }
    }
  });
  return loadProfile(userId);
}

export async function loadProviderSummaries(userIds: string[]): Promise<Map<string, ProviderSummaryDto>> {
  const summaries = new Map<string, ProviderSummaryDto>();
  if (userIds.length === 0) return summaries;

  const [users, reputations, portfolios, skills] = await Promise.all([
    query<UserRow>(
      `select ${PROFILE_COLUMNS} from users where id = any($1::uuid[])`,
      [userIds],
    ),
    query<ReputationRow & { user_id: string }>("select * from user_reputation where user_id = any($1::uuid[])", [userIds]),
    query<{ user_id: string; n: string }>(
      "select user_id, count(*) as n from portfolio_items where user_id = any($1::uuid[]) group by user_id",
      [userIds],
    ),
    query<UserSkillDto & { user_id: string }>(
      `select us.user_id, s.slug, s.name, s.category, us.level
         from user_skills us join skills s on s.id = us.skill_id
        where us.user_id = any($1::uuid[]) order by us.level desc, s.name`,
      [userIds],
    ),
  ]);

  const reputationByUser = new Map(reputations.map((row) => [row.user_id, row]));
  const portfolioByUser = new Map(portfolios.map((row) => [row.user_id, Number(row.n)]));

  for (const user of users) {
    summaries.set(user.id, {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar_url,
      location: user.location,
      availability: user.availability,
      wallet: user.wallet,
      displayName: user.display_name,
      headline: user.headline,
      keywords: user.keywords,
      isAgent: user.is_agent,
      skills: skills
        .filter((skill) => skill.user_id === user.id)
        .map(({ slug, name, category, level }) => ({ slug, name, category, level })),
      reputation: toReputation(reputationByUser.get(user.id)),
      portfolioCount: portfolioByUser.get(user.id) ?? 0,
    });
  }
  return summaries;
}
