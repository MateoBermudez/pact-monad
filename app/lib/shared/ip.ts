// Decide si una dirección IP es pública. Se usa para impedir que un webhook apunte a la red interna (SSRF):
// loopback, redes privadas, enlace local (incluido el servicio de metadatos de la nube), CGNAT, multicast y reservadas.

function parseIPv4(text: string): number[] | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return bytes.every((byte) => byte >= 0 && byte <= 255) ? bytes : null;
}

// Devuelve los 8 grupos de 16 bits, o null si no es una IPv6 válida. Admite "::" y un IPv4 incrustado al final.
function parseIPv6(text: string): number[] | null {
  if (text.includes("%")) return null;
  let address = text;
  const lastColon = address.lastIndexOf(":");
  const tail = address.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    address = `${address.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const parse = (chunk: string) => (chunk === "" ? [] : chunk.split(":"));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const numbers = groups.map((group) => (/^[0-9a-fA-F]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return numbers.length === 8 && numbers.every((n) => !Number.isNaN(n)) ? numbers : null;
}

function isPublicIPv4(b: number[]): boolean {
  const [a, c, d] = b;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && c >= 64 && c <= 127) return false;
  if (a === 169 && c === 254) return false;
  if (a === 172 && c >= 16 && c <= 31) return false;
  if (a === 192 && c === 0 && (d === 0 || d === 2)) return false;
  if (a === 192 && c === 168) return false;
  if (a === 198 && (c === 18 || c === 19)) return false;
  if (a === 198 && c === 51 && d === 100) return false;
  if (a === 203 && c === 0 && d === 113) return false;
  return a < 224;
}

function isPublicIPv6(g: number[]): boolean {
  const mapped = g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff;
  if (mapped) return isPublicIPv4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
  // Solo el unicast global (2000::/3), sin los rangos de documentación, Teredo ni 6to4 (que incrusta un IPv4).
  if ((g[0] & 0xe000) !== 0x2000) return false;
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return false;
  return g[0] !== 0x2002;
}

export function isPublicIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicIPv4(v4);
  const v6 = parseIPv6(ip);
  return v6 ? isPublicIPv6(v6) : false;
}
