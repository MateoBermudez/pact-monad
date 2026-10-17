import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { serverEnv } from "@/lib/server/env";
import { isPublicIp } from "@/lib/shared/ip";

const MAX_RESPONSE_BYTES = 4096;

export class BlockedAddressError extends Error {
  constructor(host: string) {
    super(`Dirección bloqueada: ${host} apunta a una red no pública`);
  }
}

// Se ejecuta al abrir la conexión, con la IP que de verdad se va a usar. Comprobar solo al registrar la URL no basta:
// un DNS malicioso puede responder una IP pública al validar y una interna al enviar. Si CUALQUIERA de las
// direcciones resueltas no es pública, se bloquea.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const resolved = addresses as dns.LookupAddress[];
    if (!serverEnv.webhookAllowPrivate && resolved.some((entry) => !isPublicIp(entry.address))) {
      return callback(new BlockedAddressError(hostname), "", 0);
    }
    if (options.all) return callback(null, resolved);
    return callback(null, resolved[0].address, resolved[0].family);
  });
};

export type WebhookResponse = { status: number; snippet: string };

// POST sin seguir redirecciones, con tiempo límite y lectura acotada de la respuesta.
export function postWebhook(url: URL, body: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<WebhookResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
    };

    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      { method: "POST", headers: { ...headers, "content-length": String(Buffer.byteLength(body)) }, lookup: safeLookup, timeout: timeoutMs },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size <= MAX_RESPONSE_BYTES) chunks.push(chunk);
          else response.destroy();
        });
        const done = () =>
          finish(() => resolve({ status: response.statusCode ?? 0, snippet: Buffer.concat(chunks).toString("utf8").slice(0, 300) }));
        response.on("end", done);
        response.on("close", done);
        response.on("error", (error) => finish(() => reject(error)));
      },
    );
    request.on("timeout", () => request.destroy(new Error("Tiempo de espera agotado")));
    request.on("error", (error) => finish(() => reject(error)));
    request.end(body);
  });
}
