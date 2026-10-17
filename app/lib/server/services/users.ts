import "server-only";
import type { Queryable } from "@/lib/server/db";

export async function ensureUser(db: Queryable, wallet: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into users (wallet) values ($1)
     on conflict (wallet) do update set wallet = excluded.wallet
     returning id`,
    [wallet.toLowerCase()],
  );
  return rows[0].id;
}
