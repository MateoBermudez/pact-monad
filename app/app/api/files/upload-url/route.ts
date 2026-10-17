import { authed, readJson } from "@/lib/server/http";
import { requestUpload } from "@/lib/server/services/files";
import { requestUploadSchema } from "@/lib/shared/schemas";

export const POST = authed(async ({ request, user }) => ({
  ticket: await requestUpload(user.id, await readJson(request, requestUploadSchema)),
}));
