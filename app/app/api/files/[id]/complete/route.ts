import { authed, parseId } from "@/lib/server/http";
import { completeUpload } from "@/lib/server/services/files";

export const POST = authed<{ id: string }>(async ({ params, user }) => ({
  file: await completeUpload(user.id, parseId(params.id)),
}));
