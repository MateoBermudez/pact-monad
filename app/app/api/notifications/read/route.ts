import { authed, readJson } from "@/lib/server/http";
import { markNotificationsRead } from "@/lib/server/services/notifications";
import { markNotificationsReadSchema } from "@/lib/shared/schemas";

export const POST = authed(async ({ request, user }) => {
  const { ids } = await readJson(request, markNotificationsReadSchema);
  return { updated: await markNotificationsRead(user.id, ids) };
});
