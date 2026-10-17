import "server-only";
import { serverEnv } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";

function config() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceKey) {
    throw new ApiError(503, "storage_not_configured", "El almacenamiento de archivos no está configurado");
  }
  return {
    base: `${serverEnv.supabaseUrl}/storage/v1`,
    headers: { Authorization: `Bearer ${serverEnv.supabaseServiceKey}`, apikey: serverEnv.supabaseServiceKey },
  };
}

const objectUrl = (base: string, scope: string, path: string) =>
  `${base}/object/${scope}${scope.endsWith("/") ? "" : "/"}${serverEnv.storageBucket}/${path}`;

export async function uploadObject(path: string, bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<void> {
  const { base, headers } = config();
  const res = await fetch(objectUrl(base, "", path), {
    method: "POST",
    headers: { ...headers, "content-type": contentType, "x-upsert": "false" },
    body: new Blob([bytes], { type: contentType }),
  });
  if (!res.ok) throw new Error(`Storage rechazó la subida (${res.status})`);
}

export async function downloadObject(path: string): Promise<Uint8Array<ArrayBuffer>> {
  const { base, headers } = config();
  const res = await fetch(objectUrl(base, "authenticated", path), { headers });
  if (!res.ok) throw new Error(`Storage no entregó el archivo (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function signObjectUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { base, headers } = config();
  const res = await fetch(objectUrl(base, "sign", path), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) throw new Error(`Storage no pudo firmar la URL (${res.status})`);
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("Storage devolvió una URL firmada vacía");
  return `${base}${body.signedURL}`;
}

export async function deleteObject(path: string): Promise<void> {
  const { base, headers } = config();
  await fetch(objectUrl(base, "", path), { method: "DELETE", headers });
}
