import { authed, parseId } from "@/lib/server/http";
import { getSignedFileUrl } from "@/lib/server/services/files";

export const GET = authed<{ id: string }>(async ({ params, user }) => getSignedFileUrl(user.id, parseId(params.id)));
