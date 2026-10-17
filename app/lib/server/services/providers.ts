import "server-only";
import { query } from "@/lib/server/db";
import { loadProviderSummaries } from "@/lib/server/services/profiles";
import type { SessionUser } from "@/lib/shared/auth";
import { providerTerms, scoreProviderSearch, sharedTerms, tokenize } from "@/lib/shared/matching";
import type { ProviderSummaryDto } from "@/lib/shared/profile";

export type ProviderSearchResult = ProviderSummaryDto & { score: number };

// Busca proveedores por habilidades y palabras; a igual relevancia, los mejor calificados aparecen primero.
export async function searchProviders(
  user: SessionUser,
  filters: { skills?: string; q?: string; limit: number },
): Promise<ProviderSearchResult[]> {
  const skillSlugs = (filters.skills ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 10);
  const terms = new Set(tokenize(filters.q ?? ""));

  const candidates = await query<{ id: string }>(
    `select u.id from users u
      where u.id <> $1
        and (u.is_agent or cardinality(u.keywords) > 0 or exists (select 1 from user_skills us where us.user_id = u.id))
        and ($2::text[] = '{}' or exists (
              select 1 from user_skills us join skills s on s.id = us.skill_id
               where us.user_id = u.id and s.slug = any($2::text[])))
      limit 500`,
    [user.id, skillSlugs],
  );
  const summaries = await loadProviderSummaries(candidates.map((row) => row.id));

  const results: ProviderSearchResult[] = [];
  for (const provider of summaries.values()) {
    const profile = { keywords: provider.keywords, skills: provider.skills };
    if (terms.size > 0 && sharedTerms(terms, providerTerms(profile)).length === 0) continue;

    results.push({
      ...provider,
      score: scoreProviderSearch({ terms, skillSlugs }, profile, {
        providerScore: provider.reputation.providerScore,
        completedAsProvider: provider.reputation.completedAsProvider,
        portfolioCount: provider.portfolioCount,
      }),
    });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, filters.limit);
}
