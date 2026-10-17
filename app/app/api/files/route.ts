import { ApiError, authed } from "@/lib/server/http";
import { saveFile } from "@/lib/server/services/files";
import { FILE_RULES } from "@/lib/shared/files";
import { filePurposeSchema } from "@/lib/shared/schemas";

const MAX_REQUEST_BYTES = Math.max(...Object.values(FILE_RULES).map((rule) => rule.maxBytes)) + 64 * 1024;

export const POST = authed(async ({ request, user }) => {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    throw new ApiError(413, "file_too_large", "El archivo supera el tamaño máximo");
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = filePurposeSchema.safeParse(form?.get("purpose"));
  if (!(file instanceof File) || !purpose.success) {
    throw new ApiError(400, "invalid_request", "Envía un campo 'file' y un 'purpose' válido");
  }
  return { file: await saveFile(user.id, purpose.data, file) };
});
