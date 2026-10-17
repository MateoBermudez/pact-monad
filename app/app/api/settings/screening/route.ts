import { authed, readJson } from "@/lib/server/http";
import { loadScreeningSettings, saveScreeningSettings } from "@/lib/server/services/settings";
import { screeningSettingsSchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ user }) => ({ settings: await loadScreeningSettings(user.id) }));

export const PUT = authed(async ({ request, user }) => ({
  settings: await saveScreeningSettings(user.id, await readJson(request, screeningSettingsSchema)),
}));
