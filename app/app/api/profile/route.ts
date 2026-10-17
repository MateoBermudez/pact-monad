import { authed, readJson } from "@/lib/server/http";
import { loadProfile, updateProfile } from "@/lib/server/services/profiles";
import { updateProfileSchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ user }) => ({ profile: await loadProfile(user.id) }));

export const PUT = authed(async ({ request, user }) => ({
  profile: await updateProfile(user.id, await readJson(request, updateProfileSchema)),
}));
