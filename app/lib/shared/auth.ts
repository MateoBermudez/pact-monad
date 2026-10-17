export type AuthMethod = "session" | "api_key";

export type SessionUser = {
  id: string;
  wallet: string;
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
