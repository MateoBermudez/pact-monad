import "server-only";
import { randomInt } from "node:crypto";
import { DatabaseError } from "pg";
import { z } from "zod";
import { query } from "@/lib/server/db";
import { conflict, notFound } from "@/lib/server/http";
import type { SessionUser } from "@/lib/shared/auth";
import {
  normalizeUsername,
  USERNAME_PROBLEM_MESSAGES,
  usernameFromText,
  usernameProblem,
  usernameVariants,
  type UsernameProblem,
} from "@/lib/shared/username";

const UNIQUE_VIOLATION = "23505";
const SUGGESTION_COUNT = 3;
const SEQUENTIAL_SUFFIXES = ["1", "2", "3", "7", "9"];
const RANDOM_SUFFIX_COUNT = 4;

export type UsernameReason = UsernameProblem | "taken";

export type UsernameCheck = {
  username: string;
  available: boolean;
  reason: UsernameReason | null;
  message: string | null;
  suggestions: string[];
};

async function takenAmong(candidates: string[]): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const rows = await query<{ username: string }>("select username from users where username = any($1::text[])", [
    candidates,
  ]);
  return new Set(rows.map((row) => row.username));
}

async function availableVariants(base: string, includeBase: boolean): Promise<string[]> {
  const randomSuffixes = Array.from({ length: RANDOM_SUFFIX_COUNT }, () => String(randomInt(10, 100)));
  const variants = usernameVariants(base, [...SEQUENTIAL_SUFFIXES, ...randomSuffixes]);
  const candidates = includeBase ? variants : variants.filter((variant) => variant !== base);
  const taken = await takenAmong(candidates);
  return candidates.filter((candidate) => !taken.has(candidate)).slice(0, SUGGESTION_COUNT);
}

export async function checkUsername(raw: string): Promise<UsernameCheck> {
  const username = normalizeUsername(raw);
  const problem = usernameProblem(username);
  if (problem) {
    return { username, available: false, reason: problem, message: USERNAME_PROBLEM_MESSAGES[problem], suggestions: [] };
  }

  const taken = await takenAmong([username]);
  if (!taken.has(username)) return { username, available: true, reason: null, message: null, suggestions: [] };

  return {
    username,
    available: false,
    reason: "taken",
    message: "Ese username ya está en uso",
    suggestions: await availableVariants(username, false),
  };
}

export async function suggestUsernames(user: SessionUser): Promise<string[]> {
  if (user.username) return [];

  const sources = [user.displayName, user.email].filter((value): value is string => Boolean(value));
  const suggestions: string[] = [];
  for (const source of sources) {
    const base = usernameFromText(source);
    if (!base) continue;
    for (const option of await availableVariants(base, true)) {
      if (!suggestions.includes(option)) suggestions.push(option);
    }
  }
  return suggestions.slice(0, SUGGESTION_COUNT);
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
