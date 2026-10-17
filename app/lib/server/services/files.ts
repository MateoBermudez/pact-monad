import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/lib/server/db";
import { ApiError, conflict, forbidden, notFound } from "@/lib/server/http";
import { createSignedUploadUrl, deleteObject, downloadObject, signObjectUrl } from "@/lib/server/storage";
import { DOCX_MIME, FILE_RULES, INLINE_SAFE_MIMES, type FileDto, type FilePurpose, type UploadTicketDto } from "@/lib/shared/files";
import type { RequestUploadInput } from "@/lib/shared/schemas";
import { fileReference } from "@/lib/shared/file-reference";

type FileRow = {
  id: string;
  owner_id: string;
  purpose: FilePurpose;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: string;
  sha256: string | null;
  status: "pending" | "ready";
  created_at: Date;
};

const MAX_PENDING_PER_USER = 10;
const PENDING_TTL = "1 hour";
const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

const toDto = (row: FileRow): FileDto => ({
  id: row.id,
  purpose: row.purpose,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  sha256: row.sha256 ?? "",
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
    case DOCX_MIME:
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    default:
      return !bytes.subarray(0, 1024).includes(0);
  }
}

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, "_").slice(-80) || "archivo";

async function discardPending(ownerId: string): Promise<void> {
  const stale = await query<{ storage_path: string }>(
    `delete from files where owner_id = $1 and status = 'pending' and created_at < now() - interval '${PENDING_TTL}'
     returning storage_path`,
    [ownerId],
  );
  await Promise.all(stale.map((row) => deleteObject(row.storage_path).catch(() => undefined)));
}

// Paso 1: el navegador pide permiso para subir. El archivo no viaja por una función del servidor (Vercel rechaza cuerpos
// de más de 4,5 MB): se sube directo a Storage con una URL de un solo uso, y el paso 2 comprueba lo que llegó.
export async function requestUpload(ownerId: string, input: RequestUploadInput): Promise<UploadTicketDto> {
  const rules = FILE_RULES[input.purpose];
  if (input.sizeBytes > rules.maxBytes) {
    throw new ApiError(413, "file_too_large", `El máximo para ${input.purpose} es ${Math.round(rules.maxBytes / 1024 / 1024)} MB`);
  }
  if (rules.mimeTypes && !rules.mimeTypes.includes(input.mimeType)) {
    throw new ApiError(415, "unsupported_type", `Tipo no permitido para ${input.purpose}: ${input.mimeType}`);
  }

  await discardPending(ownerId);
  const [{ pending }] = await query<{ pending: number }>(
    "select count(*)::int as pending from files where owner_id = $1 and status = 'pending'",
    [ownerId],
  );
  if (pending >= MAX_PENDING_PER_USER) throw conflict("Tienes demasiadas subidas sin confirmar; completa o espera a que venzan");

  const storagePath = `${ownerId}/${input.purpose}/${randomUUID()}-${safeName(input.fileName)}`;
  const uploadUrl = await createSignedUploadUrl(storagePath);
  const [row] = await query<{ id: string }>(
    `insert into files (owner_id, purpose, storage_path, file_name, mime_type, size_bytes, status)
     values ($1, $2, $3, $4, $5, $6, 'pending')
     returning id`,
    [ownerId, input.purpose, storagePath, input.fileName.slice(0, 200), input.mimeType, input.sizeBytes],
  );
  return {
    fileId: row.id,
    uploadUrl,
    method: "PUT",
    headers: { "content-type": input.mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
}

async function reject(row: FileRow, error: ApiError): Promise<never> {
  await deleteObject(row.storage_path).catch(() => undefined);
  await query("delete from files where id = $1 and status = 'pending'", [row.id]);
  throw error;
}

// Paso 2: el servidor descarga lo que llegó y comprueba tamaño, tipo real y hash antes de dar el archivo por bueno.
export async function completeUpload(ownerId: string, fileId: string): Promise<FileDto> {
  const [row] = await query<FileRow>("select * from files where id = $1 and owner_id = $2", [fileId, ownerId]);
  if (!row) throw notFound("Archivo");
  if (row.status === "ready") throw conflict("Este archivo ya está confirmado");

  const rules = FILE_RULES[row.purpose];
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await downloadObject(row.storage_path);
  } catch {
    throw new ApiError(409, "not_uploaded", "Todavía no se subió el archivo a la URL que te dimos");
  }

  if (bytes.length === 0 || bytes.length > rules.maxBytes) {
    await reject(row, new ApiError(413, "file_too_large", `El archivo está vacío o supera ${Math.round(rules.maxBytes / 1024 / 1024)} MB`));
  }
  if (bytes.length !== Number(row.size_bytes)) {
    await reject(row, new ApiError(400, "size_mismatch", "El tamaño del archivo no coincide con el que declaraste"));
  }
  if (rules.mimeTypes && !matchesMime(bytes, row.mime_type)) {
    await reject(row, new ApiError(415, "content_mismatch", "El contenido del archivo no coincide con su tipo"));
  }

  const [ready] = await query<FileRow>(
    `update files set status = 'ready', sha256 = $2 where id = $1 and status = 'pending' returning *`,
    [fileId, createHash("sha256").update(bytes).digest("hex")],
  );
  if (!ready) throw conflict("Este archivo ya está confirmado");
  return toDto(ready);
}

async function loadFile(fileId: string): Promise<FileRow> {
  const [row] = await query<FileRow>("select * from files where id = $1 and status = 'ready'", [fileId]);
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
    `select a.id from agreements a where a.evidence_url = $1 and a.provider_id = $3 and $2 in (a.client_id, a.provider_id)`,
    [fileReference(file.id), userId, file.owner_id],
  );
  return Boolean(party);
}

export async function getSignedFileUrl(userId: string | null, fileId: string): Promise<{ url: string; file: FileDto }> {
  const file = await loadFile(fileId);
  if (!(await canRead(userId, file))) {
    throw userId ? forbidden("No tienes acceso a este archivo") : new ApiError(401, "unauthenticated", "Inicia sesión para ver este archivo");
  }
  // Lo que no es un formato seguro de mostrar (HTML, SVG, ejecutables...) se descarga en vez de abrirse en el navegador.
  const download = INLINE_SAFE_MIMES.includes(file.mime_type) ? undefined : file.file_name;
  return { url: await signObjectUrl(file.storage_path, 300, download), file: toDto(file) };
}

// Nombre y tipo de un archivo, con la misma regla de acceso que la descarga y sin firmar ninguna URL.
export async function getFileInfo(userId: string | null, fileId: string): Promise<FileDto> {
  const file = await loadFile(fileId);
  if (!(await canRead(userId, file))) {
    throw userId ? forbidden("No tienes acceso a este archivo") : new ApiError(401, "unauthenticated", "Inicia sesión para ver este archivo");
  }
  return toDto(file);
}

export async function requireOwnedFile(userId: string, fileId: string, purpose: FilePurpose): Promise<FileRow> {
  const file = await loadFile(fileId);
  if (file.owner_id !== userId || file.purpose !== purpose) throw forbidden("El archivo no es tuyo o no es del tipo esperado");
  return file;
}

export async function readFileBytes(file: Pick<FileRow, "storage_path">): Promise<Uint8Array<ArrayBuffer>> {
  return downloadObject(file.storage_path);
}
