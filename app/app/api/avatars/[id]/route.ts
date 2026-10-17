import { open, parseId, ApiError } from "@/lib/server/http";
import { getSignedFileUrl } from "@/lib/server/services/files";
import { AVATAR_MIME_TYPES, AVATAR_MAX_BYTES } from "@/lib/shared/avatar";

export const GET = open<{ id: string }>(async ({ params }) => {
  const { url, file } = await getSignedFileUrl(null, parseId(params.id));
  if (!AVATAR_MIME_TYPES.includes(file.mimeType) || file.sizeBytes > AVATAR_MAX_BYTES) {
    throw new ApiError(404, "not_found");
  }
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
});
