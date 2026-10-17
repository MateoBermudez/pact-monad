import { optional } from "@/lib/server/http";
import { loadPublicProfile } from "@/lib/server/services/profiles";
import { resolveUserRef } from "@/lib/server/services/username";

export const GET = optional<{ id: string }>(async ({ params }) => ({
  profile: await loadPublicProfile(await resolveUserRef(params.id)),
}));
