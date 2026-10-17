import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getAddress, isAddress, verifyMessage } from "ethers";
import { query } from "@/lib/server/db";
import { CHAIN_ID } from "@/lib/shared/chain";
import type { SessionUser } from "@/lib/shared/auth";

export const SESSION_COOKIE = "pact_session";
const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

type UserRow = { id: string; wallet: string; display_name: string | null; is_agent: boolean };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const toSessionUser = (row: UserRow): SessionUser => ({
  id: row.id,
  wallet: row.wallet,
  displayName: row.display_name,
  isAgent: row.is_agent,
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
  return toSessionUser(user);
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
  await query("delete from auth_nonces where expires_at < now()");

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await query<UserRow>(
    `select u.id, u.wallet, u.display_name, u.is_agent
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
  return row ? toSessionUser(row) : null;
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [sha256(token)]);
  store.delete(SESSION_COOKIE);
}
