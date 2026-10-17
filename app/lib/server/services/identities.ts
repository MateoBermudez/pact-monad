import "server-only";
import type { PoolClient } from "pg";
import { consumeChallenge, toSessionUser, USER_COLUMNS, type UserRow } from "@/lib/server/auth";
import { query, withTransaction } from "@/lib/server/db";
import { ApiError, conflict, notFound } from "@/lib/server/http";
import type { SessionUser } from "@/lib/shared/auth";

const DISPLAY_NAME_MAX = 60;

export type SocialProfile = {
  authId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type LinkWalletResult = { user: SessionUser; merged: boolean };

const cleanName = (name: string | null) => (name ? name.trim().slice(0, DISPLAY_NAME_MAX) || null : null);

export async function signInSocial(profile: SocialProfile): Promise<SessionUser> {
  const [row] = await query<UserRow>(
    `insert into users (auth_id, email, avatar_url, display_name) values ($1, $2, $3, $4)
     on conflict (auth_id) do update set
       email = coalesce(excluded.email, users.email),
       avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
       display_name = coalesce(users.display_name, excluded.display_name)
     returning ${USER_COLUMNS}`,
    [profile.authId, profile.email, profile.avatarUrl, cleanName(profile.name)],
  );
  await query("insert into ai_settings (user_id) values ($1) on conflict do nothing", [row.id]);
  return toSessionUser(row, "session");
}

export async function attachSocial(userId: string, profile: SocialProfile): Promise<SessionUser> {
  return withTransaction(async (client) => {
    const { rows: mine } = await client.query<{ auth_id: string | null }>(
      "select auth_id from users where id = $1 for update",
      [userId],
    );
    if (!mine[0]) throw notFound("Usuario");
    if (mine[0].auth_id && mine[0].auth_id !== profile.authId) {
      throw conflict("Tu cuenta ya tiene otro inicio de sesión social vinculado");
    }

    const { rows: owner } = await client.query<{ id: string }>("select id from users where auth_id = $1", [
      profile.authId,
    ]);
    if (owner[0] && owner[0].id !== userId) {
      throw conflict("Esa cuenta de Google o GitHub ya pertenece a otro usuario de PACT");
    }

    const { rows } = await client.query<UserRow>(
      `update users set
         auth_id = $2,
         email = coalesce(email, $3),
         avatar_url = coalesce(avatar_url, $4),
         display_name = coalesce(display_name, $5)
       where id = $1
       returning ${USER_COLUMNS}`,
      [userId, profile.authId, profile.email, profile.avatarUrl, cleanName(profile.name)],
    );
    return toSessionUser(rows[0], "session");
  });
}

async function hasActivity(client: PoolClient, userId: string): Promise<boolean> {
  const { rows } = await client.query<{ active: boolean }>(
    `select (
       exists (select 1 from listings where client_id = $1)
       or exists (select 1 from applications where provider_id = $1)
       or exists (select 1 from agreements where client_id = $1 or provider_id = $1)
       or exists (select 1 from ratings where rater_id = $1 or ratee_id = $1)
       or exists (select 1 from credit_purchases where user_id = $1)
       or exists (select 1 from files where owner_id = $1)
       or exists (select 1 from portfolio_items where user_id = $1)
     ) as active`,
    [userId],
  );
  return rows[0].active;
}

type SocialRow = UserRow & { auth_id: string | null; headline: string | null; bio: string | null; keywords: string[] };

async function mergeIntoWalletAccount(client: PoolClient, social: SocialRow, walletUserId: string): Promise<SessionUser> {
  await client.query(
    `insert into user_skills (user_id, skill_id, level)
     select $2, skill_id, level from user_skills where user_id = $1
     on conflict (user_id, skill_id) do nothing`,
    [social.id, walletUserId],
  );
  await client.query("delete from users where id = $1", [social.id]);

  const { rows } = await client.query<UserRow>(
    `update users set
       auth_id = $2,
       email = coalesce(email, $3),
       avatar_url = coalesce(avatar_url, $4),
       display_name = coalesce(display_name, $5),
       headline = coalesce(headline, $6),
       bio = coalesce(bio, $7),
       keywords = case when cardinality(keywords) = 0 then $8::text[] else keywords end,
       username = coalesce(username, $9)
     where id = $1
     returning ${USER_COLUMNS}`,
    [walletUserId, social.auth_id, social.email, social.avatar_url, social.display_name, social.headline, social.bio, social.keywords, social.username],
  );
  return toSessionUser(rows[0], "session");
}

export async function linkWallet(userId: string, wallet: string, signature: string): Promise<LinkWalletResult> {
  if (!(await consumeChallenge(wallet, signature))) {
    throw new ApiError(401, "invalid_signature", "La firma no es válida o el reto expiró");
  }

  return withTransaction(async (client) => {
    const { rows: mine } = await client.query<SocialRow>(
      `select ${USER_COLUMNS}, auth_id, headline, bio, keywords from users where id = $1 for update`,
      [userId],
    );
    const me = mine[0];
    if (!me) throw notFound("Usuario");

    if (me.wallet === wallet) return { user: toSessionUser(me, "session"), merged: false };
    if (me.wallet) throw conflict("Tu cuenta ya tiene otra wallet vinculada");

    const { rows: others } = await client.query<{ id: string; auth_id: string | null }>(
      "select id, auth_id from users where wallet = $1 for update",
      [wallet],
    );
    const other = others[0];

    if (!other) {
      const { rows } = await client.query<UserRow>(
        `update users set wallet = $2 where id = $1 returning ${USER_COLUMNS}`,
        [userId, wallet],
      );
      return { user: toSessionUser(rows[0], "session"), merged: false };
    }

    if (other.auth_id) throw conflict("Esa wallet ya está vinculada a otra cuenta de PACT");
    if (await hasActivity(client, userId)) {
      throw conflict("Tu cuenta ya tiene actividad y esa wallet también; no se pueden unir automáticamente");
    }

    return { user: await mergeIntoWalletAccount(client, me, other.id), merged: true };
  });
}
