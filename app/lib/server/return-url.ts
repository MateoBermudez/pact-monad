import "server-only";
import { serverEnv } from "@/lib/server/env";
import { HOME_AFTER_LOGIN, LOGIN_PATH } from "@/lib/shared/routes";

export const RETURN_COOKIE = "pact_oauth_next";
export const MODE_COOKIE = "pact_oauth_mode";

function isRelativePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

export function resolveReturnUrl(next: string | null | undefined): URL {
  const base = serverEnv.frontendOrigins[0];
  const fallback = new URL(HOME_AFTER_LOGIN, base);
  if (!next) return fallback;

  if (isRelativePath(next)) return new URL(next, base);

  try {
    const candidate = new URL(next);
    return serverEnv.frontendOrigins.includes(candidate.origin) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

export function loginUrl(): URL {
  return new URL(LOGIN_PATH, serverEnv.frontendOrigins[0]);
}

export function withError(target: URL, code: string): URL {
  const url = new URL(target);
  url.searchParams.set("auth_error", code);
  return url;
}
