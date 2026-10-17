import { authed, parseId, readJson } from "@/lib/server/http";
import { listChat, sendMessage } from "@/lib/server/services/chat";
import { sendMessageSchema } from "@/lib/shared/schemas";

export const GET = authed<{ id: string }>(async ({ params, user }) => ({ chat: await listChat(user, parseId(params.id)) }));

export const POST = authed<{ id: string }>(async ({ request, params, user }) => ({
  message: await sendMessage(user, parseId(params.id), await readJson(request, sendMessageSchema)),
}));
