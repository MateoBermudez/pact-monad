import { authed, parseId } from "@/lib/server/http";
import { rotateSecret } from "@/lib/server/services/webhook-endpoints";

export const POST = authed<{ id: string }>(async ({ params, user }) => rotateSecret(user.id, parseId(params.id)));
