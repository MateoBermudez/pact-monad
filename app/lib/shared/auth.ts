export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const SESSION_COOKIE = "pact_session";

export const ROLES = ["client", "provider"] as const;
export type Role = (typeof ROLES)[number];

export type AuthMethod = "session" | "api_key";

export type SessionUser = {
  id: string;
  username: string | null;
  roles: Role[];
  wallet: string | null;
  email: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  isAgent: boolean;
  via: AuthMethod;
};

export type AgentKeyDto = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type IdentityDto = {
  provider: string;
  email: string | null;
  linkedAt: string;
};

export type OnboardingStatus = {
  needsUsername: boolean;
  needsSkills: boolean;
  needsRole: boolean;
  complete: boolean;
};
