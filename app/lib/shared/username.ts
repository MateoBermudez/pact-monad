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

export function usernameError(value: string): string | null {
  if (!USERNAME_PATTERN.test(value)) return USERNAME_RULES;
  if (RESERVED_USERNAMES.has(value)) return "Ese username está reservado";
  return null;
}
