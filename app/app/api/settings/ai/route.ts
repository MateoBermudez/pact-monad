import { authed } from "@/lib/server/http";
import { loadAiSettings } from "@/lib/server/services/settings";

export const GET = authed(async ({ user }) => ({ settings: await loadAiSettings(user.id) }));
