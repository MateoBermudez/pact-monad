export const LOGIN_PATH = "/iniciar-sesion";
export const HOME_AFTER_LOGIN = "/dashboard";
export const ONBOARDING_PATH = "/perfil";

export const GUEST_ONLY_PATHS: readonly string[] = [LOGIN_PATH, "/registro"];
export const LANDING_PATH = "/";
export const PUBLIC_PATHS: readonly string[] = [LANDING_PATH, ...GUEST_ONLY_PATHS, "/terminos", "/privacidad"];

export const isPublicPath = (pathname: string): boolean => PUBLIC_PATHS.includes(pathname);

export function decideRoute(pathname: string, hasSession: boolean): string | null {
  if (!hasSession && !isPublicPath(pathname)) return LOGIN_PATH;
  // The proxy only knows whether a cookie exists, not whether the session is valid.
  // An expired/revoked cookie must never prevent someone from opening sign-in.
  return null;
}
