// Firma de webhooks con HMAC-SHA256 (Web Crypto, funciona en Node, navegadores y agentes en TypeScript).
// El receptor debe verificar la firma y rechazar mensajes con marca de tiempo antigua para evitar repeticiones.

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante: no revela cuántos caracteres coinciden.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Valor de la cabecera X-Pact-Signature: "t=<segundos>,v1=<hmac>". Se firma "<t>.<cuerpo exacto>".
export async function signWebhook(secret: string, timestamp: number, body: string): Promise<string> {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${body}`)}`;
}

export async function verifyWebhook(
  secret: string,
  header: string | null,
  body: string,
  options: { toleranceSeconds?: number; nowMs?: number } = {},
): Promise<boolean> {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!match) return false;

  const timestamp = Number(match[1]);
  const ageSeconds = Math.abs((options.nowMs ?? Date.now()) / 1000 - timestamp);
  if (ageSeconds > (options.toleranceSeconds ?? 300)) return false;

  return safeEqual(match[2], await hmacHex(secret, `${timestamp}.${body}`));
}
