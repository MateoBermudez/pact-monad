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
