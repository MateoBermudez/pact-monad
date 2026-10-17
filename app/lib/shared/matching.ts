export type SkillRef = { slug: string; name: string; category: string; level: number };

export type ProviderProfile = { keywords: string[]; skills: SkillRef[] };

export type ListingProfile = {
  title: string;
  category: string | null;
  keywords: string[];
  budgetMon: number | null;
};

export type ProviderStats = {
  providerScore: number;
  completedAsProvider: number;
  portfolioCount: number;
};

export type MatchBreakdown = {
  total: number;
  reputation: number;
  skills: number;
  experience: number;
  portfolio: number;
  price: number;
};

export type ListingMatch = { score: number; reasons: string[] };

export type ApplicantMatch = { breakdown: MatchBreakdown; reasons: string[] };

const STOP_WORDS = new Set([
  "de", "la", "el", "en", "un", "es", "al", "lo", "se", "su", "me", "mi", "por", "con", "una", "uno", "los", "las",
  "del", "que", "para", "and", "the", "for", "quiero",
]);
const MS_PER_DAY = 86_400_000;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Quita la "s" final de plurales sencillos para que "logos" coincida con "logo". Solo en palabras alfabéticas:
// "node.js" o "c#" no se tocan.
function stem(token: string): string {
  return /^[a-z]+$/.test(token) && token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token;
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .map(stem);
}

export function providerTerms(profile: ProviderProfile): Set<string> {
  const terms = new Set<string>();
  for (const keyword of profile.keywords) tokenize(keyword).forEach((term) => terms.add(term));
  for (const skill of profile.skills) {
    tokenize(skill.name).forEach((term) => terms.add(term));
    tokenize(skill.slug.replace(/-/g, " ")).forEach((term) => terms.add(term));
  }
  return terms;
}

export function listingTerms(listing: Pick<ListingProfile, "title" | "keywords">): Set<string> {
  const terms = new Set<string>();
  for (const keyword of listing.keywords) tokenize(keyword).forEach((term) => terms.add(term));
  tokenize(listing.title).forEach((term) => terms.add(term));
  return terms;
}

export function sharedTerms(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((term) => b.has(term));
}

// Proporción de términos de la solicitud que el proveedor cubre; con pocos términos se exige al menos 3 para no premiar coincidencias casuales.
function overlap(listing: Set<string>, provider: Set<string>): { ratio: number; shared: string[] } {
  const shared = sharedTerms(listing, provider);
  return { ratio: clamp01(shared.length / Math.min(8, Math.max(3, listing.size))), shared };
}

function categoryMatches(category: string | null, skills: SkillRef[]): boolean {
  if (!category) return false;
  const wanted = normalizeText(category).trim();
  return skills.some((skill) => normalizeText(skill.category).trim() === wanted);
}

const reputationFraction = (score: number) => clamp01((score - 1) / 4);
const experienceFraction = (completed: number) => clamp01(Math.log2(1 + completed) / 4);

// Qué tan bien encaja una solicitud abierta con el perfil de un proveedor (recomendaciones).
export function scoreListingForProvider(
  listing: ListingProfile & { createdAt: Date },
  provider: ProviderProfile,
  clientScore: number,
  now: Date = new Date(),
): ListingMatch {
  const { ratio, shared } = overlap(listingTerms(listing), providerTerms(provider));
  const sameCategory = categoryMatches(listing.category, provider.skills);
  const ageDays = Math.max(0, (now.getTime() - listing.createdAt.getTime()) / MS_PER_DAY);
  const freshness = Math.exp(-ageDays / 14);

  const score = 100 * (0.6 * ratio + 0.2 * Number(sameCategory) + 0.1 * reputationFraction(clientScore) + 0.1 * freshness);

  const reasons: string[] = [];
  if (shared.length > 0) reasons.push(`Coincide en: ${shared.slice(0, 4).join(", ")}`);
  if (sameCategory) reasons.push(`Categoría: ${listing.category}`);
  if (clientScore >= 4) reasons.push(`Cliente con buena reputación (${clientScore.toFixed(1)})`);
  return { score: round1(score), reasons };
}

// Qué tan bien encaja un postulante con una solicitud (ranking para el cliente). La calificación pesa más que cualquier otro factor.
export function scoreApplicant(
  listing: ListingProfile,
  provider: ProviderProfile,
  stats: ProviderStats,
  priceMon: number | null,
): ApplicantMatch {
  const { ratio, shared } = overlap(listingTerms(listing), providerTerms(provider));
  const sameCategory = categoryMatches(listing.category, provider.skills);

  const reputation = reputationFraction(stats.providerScore);
  const skills = clamp01(0.8 * ratio + 0.2 * Number(sameCategory));
  const experience = experienceFraction(stats.completedAsProvider);
  const portfolio = clamp01(stats.portfolioCount / 3);
  const price =
    priceMon === null || listing.budgetMon === null ? 0.5 : priceMon <= listing.budgetMon ? 1 : clamp01(listing.budgetMon / priceMon);

  const total = 100 * (0.4 * reputation + 0.3 * skills + 0.1 * experience + 0.1 * portfolio + 0.1 * price);

  const reasons: string[] = [];
  reasons.push(`Calificación ${stats.providerScore.toFixed(1)}/5`);
  if (stats.completedAsProvider > 0) reasons.push(`${stats.completedAsProvider} trabajos completados`);
  if (shared.length > 0) reasons.push(`Habilidades que coinciden: ${shared.slice(0, 4).join(", ")}`);
  if (stats.portfolioCount > 0) reasons.push(`${stats.portfolioCount} proyectos en su portafolio`);
  if (priceMon !== null && listing.budgetMon !== null && priceMon > listing.budgetMon) reasons.push("Su precio supera tu presupuesto");

  return {
    breakdown: {
      total: round1(total),
      reputation: round1(reputation * 100),
      skills: round1(skills * 100),
      experience: round1(experience * 100),
      portfolio: round1(portfolio * 100),
      price: round1(price * 100),
    },
    reasons,
  };
}

// Orden de la búsqueda de proveedores: relevancia con lo buscado y calificación.
export function scoreProviderSearch(
  query: { terms: Set<string>; skillSlugs: string[] },
  provider: ProviderProfile,
  stats: ProviderStats,
): number {
  const own = providerTerms(provider);
  const termOverlap = query.terms.size === 0 ? 0 : sharedTerms(query.terms, own).length / query.terms.size;
  const skillOverlap =
    query.skillSlugs.length === 0
      ? 0
      : query.skillSlugs.filter((slug) => provider.skills.some((skill) => skill.slug === slug)).length / query.skillSlugs.length;
  const relevance = query.terms.size === 0 && query.skillSlugs.length === 0 ? 0.5 : Math.max(termOverlap, skillOverlap);

  const total =
    100 * (0.5 * relevance + 0.4 * reputationFraction(stats.providerScore) + 0.1 * experienceFraction(stats.completedAsProvider));
  return round1(total);
}
