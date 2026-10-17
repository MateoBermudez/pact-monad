import { authed, readJson } from "@/lib/server/http";
import { createEndpoint, listEndpoints } from "@/lib/server/services/webhook-endpoints";
import { createWebhookSchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ user }) => ({ webhooks: await listEndpoints(user.id) }));

// El secreto solo se devuelve aquí, una vez: sirve para verificar la firma de cada aviso.
export const POST = authed(async ({ request, user }) => createEndpoint(user.id, await readJson(request, createWebhookSchema)));
