import { authed, parseId, readJson } from "@/lib/server/http";
import { deleteEndpoint, updateEndpoint } from "@/lib/server/services/webhook-endpoints";
import { updateWebhookSchema } from "@/lib/shared/schemas";

export const PATCH = authed<{ id: string }>(async ({ request, params, user }) => ({
  webhook: await updateEndpoint(user.id, parseId(params.id), await readJson(request, updateWebhookSchema)),
}));

export const DELETE = authed<{ id: string }>(async ({ params, user }) => {
  await deleteEndpoint(user.id, parseId(params.id));
  return { ok: true };
});
