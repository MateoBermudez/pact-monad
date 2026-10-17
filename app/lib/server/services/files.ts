import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { ApiError, forbidden, notFound } from "@/lib/server/http";
import { deleteObject, downloadObject, signObjectUrl, uploadObject } from "@/lib/server/storage";
import { FILE_RULES, type FileDto, type FilePurpose } from "@/lib/shared/files";

type FileRow = {
  id: string;
  owner_id: string;
  purpose: FilePurpose;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: string;
  sha256: string;
  created_at: Date;
};

const toDto = (row: FileRow): FileDto => ({
  id: row.id,
  purpose: row.purpose,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  sha256: row.sha256,
  createdAt: row.created_at.toISOString(),
});

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

// No se confía en el tipo que declara el navegador: se comprueban los primeros bytes de los formatos binarios.
function matchesMime(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "application/zip":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    default:
      return !bytes.subarray(0, 1024).includes(0);
  }
}

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, "_").slice(-80) || "archivo";

export async function saveFile(ownerId: string, purpose: FilePurpose, file: File): Promise<FileDto> {
  const rules = FILE_RULES[purpose];
  if (file.size === 0) throw new ApiError(400, "empty_file", "El archivo está vacío");
  if (file.size > rules.maxBytes) {
    throw new ApiError(413, "file_too_large", `El máximo es ${Math.round(rules.maxBytes / 1024 / 1024)} MB`);
  }
  if (!rules.mimeTypes.includes(file.type)) {
    throw new ApiError(415, "unsupported_type", `Tipo no permitido para ${purpose}: ${file.type || "desconocido"}`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesMime(bytes, file.type)) {
    throw new ApiError(415, "content_mismatch", "El contenido del archivo no coincide con su tipo");
  }

  const storagePath = `${ownerId}/${purpose}/${randomUUID()}-${safeName(file.name)}`;
  await uploadObject(storagePath, bytes, file.type);

  const [row] = await query<FileRow>(
    `insert into files (owner_id, purpose, storage_path, file_name, mime_type, size_bytes, sha256)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [ownerId, purpose, storagePath, file.name.slice(0, 200), file.type, file.size, createHash("sha256").update(bytes).digest("hex")],
  ).catch(async (error: unknown) => {
    await deleteObject(storagePath);
    throw error;
  });
  return toDto(row);
}

async function loadFile(fileId: string): Promise<FileRow> {
  const [row] = await query<FileRow>("select * from files where id = $1", [fileId]);
  if (!row) throw notFound("Archivo");
  return row;
}

// El portafolio es público (así se puede explorar sin iniciar sesión); el dueño siempre ve lo suyo; el brief de una
// solicitud abierta, cualquier usuario con sesión; la evidencia, solo las partes del acuerdo.
async function canRead(userId: string | null, file: FileRow): Promise<boolean> {
  if (file.purpose === "portfolio") return true;
  if (!userId) return false;
  if (file.owner_id === userId) return true;
  if (file.purpose === "brief") {
    const [listing] = await query<{ id: string }>(
      "select id from listings where brief_file_id = $1 and status in ('open', 'selecting', 'awarded')",
      [file.id],
    );
    return Boolean(listing);
  }
  const [party] = await query<{ id: string }>(
    `select a.id from agreements a join listings l on l.id = a.listing_id
      where l.brief_file_id = $1 and $2 in (a.client_id, a.provider_id)`,
    [file.id, userId],
  );
  return Boolean(party);
}

export async function getSignedFileUrl(userId: string | null, fileId: string): Promise<{ url: string; file: FileDto }> {
  const file = await loadFile(fileId);
  if (!(await canRead(userId, file))) {
    throw userId ? forbidden("No tienes acceso a este archivo") : new ApiError(401, "unauthenticated", "Inicia sesión para ver este archivo");
  }
  return { url: await signObjectUrl(file.storage_path), file: toDto(file) };
}

export async function requireOwnedFile(userId: string, fileId: string, purpose: FilePurpose): Promise<FileRow> {
  const file = await loadFile(fileId);
  if (file.owner_id !== userId || file.purpose !== purpose) throw forbidden("El archivo no es tuyo o no es del tipo esperado");
  return file;
}

export async function readFileBytes(file: Pick<FileRow, "storage_path">): Promise<Uint8Array<ArrayBuffer>> {
  return downloadObject(file.storage_path);
}
