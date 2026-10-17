import "client-only";
import { ApiRequestError, postJson } from "@/lib/client/api";
import type { FileDto, FilePurpose, UploadTicketDto } from "@/lib/shared/files";

// Sube un archivo directo a Storage (sin pasar por una función del servidor, que en Vercel rechaza más de 4,5 MB)
// y devuelve el archivo ya validado por el servidor.
export async function uploadFile(file: File, purpose: FilePurpose): Promise<FileDto> {
  const { ticket } = await postJson<{ ticket: UploadTicketDto }>("/api/files/upload-url", {
    purpose,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  const put = await fetch(ticket.uploadUrl, { method: ticket.method, headers: ticket.headers, body: file });
  if (!put.ok) throw new ApiRequestError(put.status, "upload_failed", `La subida falló (${put.status})`);

  return (await postJson<{ file: FileDto }>(`/api/files/${ticket.fileId}/complete`, {})).file;
}
