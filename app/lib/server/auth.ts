import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getAddress, isAddress, verifyMessage } from "ethers";
import { query } from "@/lib/server/db";
import { CHAIN_ID } from "@/lib/shared/chain";
import type { AuthMethod, SessionUser } from "@/lib/shared/auth";

export const SESSION_COOKIE = "pact_session";
export const API_KEY_PREFIX = "pact_ak_";

const CHALLENGE_TTL_MS = 5 * 60_000;
// Sesión deslizante: dura 30 días desde el último uso y se renueva como máximo una vez al día; tope absoluto de 90.
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const RENEW_AFTER_MS = 24 * 60 * 60_000;
const SESSION_MAX_AGE_DAYS = 90;

type UserRow = { id: string; wallet: string; display_name: string | null; is_agent: boolean };

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const toSessionUser = (row: UserRow, via: AuthMethod): SessionUser => ({
  id: row.id,
  wallet: row.wallet,
  displayName: row.display_name,
  isAgent: row.is_agent,
  via,
});

export function parseAddress(value: unknown): string | null {
  return typeof value === "string" && isAddress(value) ? value.toLowerCase() : null;
}

export function isSignature(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{130}$/.test(value);
}

// Mensaje con formato EIP-4361 (Sign-In with Ethereum): MetaMask lo reconoce y lo muestra de forma legible.
export async function issueChallenge(wallet: string, origin: URL): Promise<string> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const message = [
    `${origin.host} wants you to sign in with your Ethereum account:`,
    getAddress(wallet),
    "",
    "Inicia sesión en PACT. Firmar no cuesta gas ni mueve fondos.",
    "",
    `URI: ${origin.origin}`,
    "Version: 1",
    `Chain ID: ${CHAIN_ID}`,
    `Nonce: ${randomBytes(16).toString("hex")}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");

  await query("delete from auth_nonces where expires_at < now()");
  await query(
    `insert into auth_nonces (wallet, message, expires_at) values ($1, $2, $3)
     on conflict (wallet) do update set message = excluded.message, expires_at = excluded.expires_at`,
    [wallet, message, expiresAt],
  );
  return message;
}

// El reto se consume al leerlo: sirve para un solo intento, así una firma robada no se puede reutilizar.
export async function verifyChallenge(wallet: string, signature: string): Promise<SessionUser | null> {
  const [challenge] = await query<{ message: string }>(
    "delete from auth_nonces where wallet = $1 and expires_at > now() returning message",
    [wallet],
  );
  if (!challenge) return null;

  let signer: string;
  try {
    signer = verifyMessage(challenge.message, signature).toLowerCase();
  } catch {
    return null;
  }
  if (signer !== wallet) return null;

  const [user] = await query<UserRow>(
    `insert into users (wallet) values ($1)
     on conflict (wallet) do update set wallet = excluded.wallet
     returning id, wallet, display_name, is_agent`,
    [wallet],
  );
  await query("insert into ai_settings (user_id) values ($1) on conflict do nothing", [user.id]);
  return toSessionUser(user, "session");
}

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    sha256(token),
    userId,
    expiresAt,
  ]);
  await query("delete from sessions where expires_at < now()");
  await setSessionCookie(token, expiresAt);
}

async function userFromCookie(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const [row] = await query<UserRow & { last_seen_at: Date }>(
    `select u.id, u.wallet, u.display_name, u.is_agent, s.last_seen_at
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()
        and s.created_at > now() - make_interval(days => $2)`,
    [tokenHash, SESSION_MAX_AGE_DAYS],
  );
  if (!row) return null;

  if (Date.now() - row.last_seen_at.getTime() > RENEW_AFTER_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await query("update sessions set expires_at = $2, last_seen_at = now() where token_hash = $1", [tokenHash, expiresAt]);
    // Solo se puede escribir la cookie desde un route handler; en otros contextos la renovación igual queda en la base.
    await setSessionCookie(token, expiresAt).catch(() => undefined);
  }
  return toSessionUser(row, "session");
}

async function userFromApiKey(authorization: string): Promise<SessionUser | null> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
  if (!token?.startsWith(API_KEY_PREFIX)) return null;

  const [row] = await query<UserRow & { key_id: string }>(
    `select u.id, u.wallet, u.display_name, u.is_agent, k.id as key_id
       from api_keys k join users u on u.id = k.user_id
      where k.key_hash = $1 and k.revoked_at is null and (k.expires_at is null or k.expires_at > now())
        and u.is_agent`,
    [sha256(token)],
  );
  if (!row) return null;

  await query(
    "update api_keys set last_used_at = now() where id = $1 and (last_used_at is null or last_used_at < now() - interval '1 minute')",
    [row.key_id],
  );
  return toSessionUser(row, "api_key");
}

// Una cabecera Authorization manda sobre la cookie: si trae una clave inválida no se cae a la sesión de otra persona.
export async function getSessionUser(): Promise<SessionUser | null> {
  const authorization = (await headers()).get("authorization");
  return authorization ? userFromApiKey(authorization) : userFromCookie();
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [sha256(token)]);
  store.delete(SESSION_COOKIE);
}
