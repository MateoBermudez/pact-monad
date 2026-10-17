import { optional, parseId } from "@/lib/server/http";
import { loadPublicProfile } from "@/lib/server/services/profiles";

export const GET = optional<{ id: string }>(async ({ params }) => ({
  profile: await loadPublicProfile(parseId(params.id)),
}));
