import { authed } from "@/lib/server/http";
import { suggestUsernames } from "@/lib/server/services/username";

export const GET = authed(async ({ user }) => ({ suggestions: await suggestUsernames(user) }));
