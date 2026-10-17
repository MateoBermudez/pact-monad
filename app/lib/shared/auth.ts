export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export type SessionUser = {
  id: string;
  wallet: string | null;
  email: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  isAgent: boolean;
};
