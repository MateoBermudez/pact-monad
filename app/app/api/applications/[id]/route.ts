import { authed, parseId, readJson } from "@/lib/server/http";
import { actOnApplication } from "@/lib/server/services/applications";
import { applicationActionSchema } from "@/lib/shared/schemas";

export const PATCH = authed<{ id: string }>(async ({ request, params, user }) => {
  const { action } = await readJson(request, applicationActionSchema);
  return actOnApplication(user, parseId(params.id), action);
});
