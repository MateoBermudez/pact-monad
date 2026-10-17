import "server-only";
import { DatabaseError } from "pg";
import { query } from "@/lib/server/db";
import { conflict, notFound } from "@/lib/server/http";
import { normalizeUsername } from "@/lib/shared/username";
import { z } from "zod";

const UNIQUE_VIOLATION = "23505";

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const rows = await query("select 1 from users where username = $1", [username]);
  return rows.length === 0;
}

export async function setUsername(userId: string, username: string): Promise<string> {
  try {
    const rows = await query<{ id: string }>(
      "update users set username = $2 where id = $1 and username is null returning id",
      [userId, username],
    );
    if (rows.length > 0) return username;
  } catch (error) {
    if (error instanceof DatabaseError && error.code === UNIQUE_VIOLATION) throw conflict("Ese username ya está en uso");
    throw error;
  }

  const [current] = await query<{ username: string | null }>("select username from users where id = $1", [userId]);
  if (!current) throw notFound("Usuario");
  throw conflict(`Ya tienes el username @${current.username} y no se puede cambiar`);
}

export async function resolveUserRef(ref: string): Promise<string> {
  if (z.string().uuid().safeParse(ref).success) return ref;

  const [row] = await query<{ id: string }>("select id from users where username = $1", [normalizeUsername(ref)]);
  if (!row) throw notFound("Usuario");
  return row.id;
}
