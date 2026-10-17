export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const USERNAME_RULES = "De 3 a 20 caracteres: letras minúsculas, números y guion bajo, empezando con una letra";

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "agent",
  "agents",
  "api",
  "app",
  "auth",
  "dashboard",
  "help",
  "login",
  "logout",
  "me",
  "null",
  "pact",
  "pactai",
  "root",
  "settings",
  "signin",
  "signup",
  "soporte",
  "support",
  "system",
  "undefined",
  "user",
  "users",
]);

export const normalizeUsername = (value: string): string => value.trim().toLowerCase().replace(/^@/, "");

export type UsernameProblem = "invalid" | "reserved";

export function usernameProblem(value: string): UsernameProblem | null {
  if (!USERNAME_PATTERN.test(value)) return "invalid";
  if (RESERVED_USERNAMES.has(value)) return "reserved";
  return null;
}

export const USERNAME_PROBLEM_MESSAGES: Record<UsernameProblem, string> = {
  invalid: USERNAME_RULES,
  reserved: "Ese username está reservado",
};

export function usernameError(value: string): string | null {
  const problem = usernameProblem(value);
  return problem ? USERNAME_PROBLEM_MESSAGES[problem] : null;
}

export const USERNAME_MAX_LENGTH = 20;
const USERNAME_MIN_LENGTH = 3;

export function usernameFromText(text: string): string | null {
  const base = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[0-9_]+/, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/_+$/, "");
  return base.length >= USERNAME_MIN_LENGTH ? base : null;
}

export function usernameVariants(base: string, extra: readonly string[]): string[] {
  const withSuffix = (suffix: string) => `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length).replace(/_+$/, "")}${suffix}`;
  const candidates = [base, ...extra.map(withSuffix)];
  return [...new Set(candidates)].filter((candidate) => usernameProblem(candidate) === null);
}
