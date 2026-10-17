export const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 40;

export function normalizeKeywords(input: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const raw of input) {
    const keyword = raw
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
    if (keyword && keyword.length <= MAX_KEYWORD_LENGTH) unique.add(keyword);
  }
  return [...unique].slice(0, MAX_KEYWORDS);
}

const STOPWORDS = new Set(
  (
    "para como con sin por que los las del una uno unos unas este esta estos estas ese esa esos esas pero sobre entre " +
    "desde hasta cada todo toda todos todas muy mas menos tambien solo sera ser son hay tiene tener debe deben puede " +
    "pueden busca busco necesito necesita quiero quien cual donde cuando the and for with from that this you your are"
  ).split(" "),
);
const MIN_DERIVED_LENGTH = 4;

export function deriveKeywords(text: string, limit = 10): string[] {
  const counts = new Map<string, number>();
  const words = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9.+#-]*/g);
  for (const match of words ?? []) {
    const word = match.replace(/[.-]+$/, "");
    if (word.length < MIN_DERIVED_LENGTH || STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}
