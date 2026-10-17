export const LOGIN_PATH = "/iniciar-sesion";
export const HOME_AFTER_LOGIN = "/dashboard";
export const ONBOARDING_PATH = "/perfil";

export const GUEST_ONLY_PATHS: readonly string[] = [LOGIN_PATH, "/registro"];
export const PUBLIC_PATHS: readonly string[] = [...GUEST_ONLY_PATHS, "/terminos", "/privacidad"];

export const isPublicPath = (pathname: string): boolean => PUBLIC_PATHS.includes(pathname);

export function decideRoute(pathname: string, hasSession: boolean): string | null {
  if (!hasSession && !isPublicPath(pathname)) return LOGIN_PATH;
  if (hasSession && GUEST_ONLY_PATHS.includes(pathname)) return HOME_AFTER_LOGIN;
  return null;
}
