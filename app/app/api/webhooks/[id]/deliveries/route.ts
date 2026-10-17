import { authed, parseId } from "@/lib/server/http";
import { listDeliveries } from "@/lib/server/services/webhook-endpoints";

export const GET = authed<{ id: string }>(async ({ params, user }) => ({
  deliveries: await listDeliveries(user.id, parseId(params.id)),
}));
