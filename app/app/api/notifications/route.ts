import { authed, readQuery } from "@/lib/server/http";
import { listNotifications } from "@/lib/server/services/notifications";
import { listNotificationsQuerySchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ request, user }) =>
  listNotifications(user.id, readQuery(request, listNotificationsQuerySchema).limit),
);
