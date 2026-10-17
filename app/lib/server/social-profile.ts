import "server-only";
import type { User } from "@supabase/supabase-js";
import type { SocialProfile } from "@/lib/server/services/identities";

function pickString(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

export function toSocialProfile(user: User): SocialProfile {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    authId: user.id,
    provider: pickString(user.app_metadata ?? {}, "provider") ?? user.identities?.[0]?.provider ?? "unknown",
    email: user.email ?? null,
    name: pickString(metadata, "full_name", "name", "user_name", "preferred_username"),
    avatarUrl: pickString(metadata, "avatar_url", "picture"),
  };
}
