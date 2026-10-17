import { authed, parseId } from "@/lib/server/http";
import { loadPublicProfile } from "@/lib/server/services/profiles";

export const GET = authed<{ id: string }>(async ({ params }) => ({
  profile: await loadPublicProfile(parseId(params.id)),
}));
