import "server-only";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import { serverEnv } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { isPublicIp } from "@/lib/shared/ip";

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

const invalid = (message: string) => new ApiError(400, "invalid_webhook_url", message);

// Valida una URL de webhook antes de guardarla y otra vez antes de cada envío.
export async function assertWebhookUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid("La URL no es válida");
  }

  const allowPrivate = serverEnv.webhookAllowPrivate;
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) throw invalid("La URL debe usar https");
  if (url.username || url.password) throw invalid("La URL no puede incluir usuario ni contraseña");
  if (!allowPrivate && url.port && url.port !== "443") throw invalid("Solo se admite el puerto 443");

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!allowPrivate && (host === "localhost" || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix)))) {
    throw invalid("La URL apunta a una dirección interna");
  }

  if (isIP(host)) {
    if (!allowPrivate && !isPublicIp(host)) throw invalid("La URL apunta a una dirección que no es pública");
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw invalid("No se pudo resolver el dominio de la URL");
  }
  if (!allowPrivate && addresses.some((entry) => !isPublicIp(entry.address))) {
    throw invalid("El dominio de la URL apunta a una dirección que no es pública");
  }
  return url;
}
