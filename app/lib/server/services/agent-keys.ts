import "server-only";
import { randomBytes } from "node:crypto";
import { API_KEY_PREFIX, sha256 } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { conflict, forbidden, notFound } from "@/lib/server/http";
import type { AgentKeyDto, SessionUser } from "@/lib/shared/auth";
import type { CreateAgentKeyInput } from "@/lib/shared/schemas";

const MAX_ACTIVE_KEYS = 10;

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
};

const toDto = (row: KeyRow): AgentKeyDto => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  createdAt: row.created_at.toISOString(),
  lastUsedAt: row.last_used_at?.toISOString() ?? null,
  expiresAt: row.expires_at?.toISOString() ?? null,
  revokedAt: row.revoked_at?.toISOString() ?? null,
});

const COLUMNS = "id, name, prefix, created_at, last_used_at, expires_at, revoked_at";

export async function listAgentKeys(userId: string): Promise<AgentKeyDto[]> {
  const rows = await query<KeyRow>(`select ${COLUMNS} from api_keys where user_id = $1 order by created_at desc`, [userId]);
  return rows.map(toDto);
}

// La clave en claro solo existe en esta respuesta: en la base queda únicamente su hash.
export async function createAgentKey(user: SessionUser, input: CreateAgentKeyInput): Promise<{ key: string; apiKey: AgentKeyDto }> {
  if (!user.isAgent) throw forbidden("Marca tu cuenta como agente (isAgent) antes de crear claves de API");

  const [{ active }] = await query<{ active: number }>(
    "select count(*)::int as active from api_keys where user_id = $1 and revoked_at is null and (expires_at is null or expires_at > now())",
    [user.id],
  );
  if (active >= MAX_ACTIVE_KEYS) throw conflict(`Ya tienes ${MAX_ACTIVE_KEYS} claves activas; revoca alguna primero`);

  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
  const [row] = await query<KeyRow>(
    `insert into api_keys (user_id, name, prefix, key_hash, expires_at) values ($1, $2, $3, $4, $5) returning ${COLUMNS}`,
    [user.id, input.name, key.slice(0, API_KEY_PREFIX.length + 4), sha256(key), expiresAt],
  );
  return { key, apiKey: toDto(row) };
}

export async function revokeAgentKey(userId: string, keyId: string): Promise<AgentKeyDto> {
  const [row] = await query<KeyRow>(
    `update api_keys set revoked_at = coalesce(revoked_at, now()) where id = $1 and user_id = $2 returning ${COLUMNS}`,
    [keyId, userId],
  );
  if (!row) throw notFound("Clave");
  return toDto(row);
}

