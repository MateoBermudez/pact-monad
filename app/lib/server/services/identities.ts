import "server-only";
import type { PoolClient } from "pg";
import { consumeChallenge, toSessionUser, USER_COLUMNS, type UserRow } from "@/lib/server/auth";
import { query, withTransaction } from "@/lib/server/db";
import { ApiError, conflict, notFound } from "@/lib/server/http";
import type { IdentityDto, SessionUser } from "@/lib/shared/auth";

const DISPLAY_NAME_MAX = 60;

export type SocialProfile = {
  authId: string;
  provider: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type LinkWalletResult = { user: SessionUser; merged: boolean };

const cleanName = (name: string | null) => (name ? name.trim().slice(0, DISPLAY_NAME_MAX) || null : null);

const lockIdentity = (client: PoolClient, authId: string) =>
  client.query("select pg_advisory_xact_lock(hashtext($1))", [authId]);

async function fillProfile(client: PoolClient, userId: string, profile: SocialProfile): Promise<SessionUser> {
  const { rows } = await client.query<UserRow>(
    `update users set
       email = coalesce(email, $2),
       avatar_url = coalesce(avatar_url, $3),
       display_name = coalesce(display_name, $4)
     where id = $1
     returning ${USER_COLUMNS}`,
    [userId, profile.email, profile.avatarUrl, cleanName(profile.name)],
  );
  return toSessionUser(rows[0], "session");
}

export async function signInSocial(profile: SocialProfile): Promise<SessionUser> {
  return withTransaction(async (client) => {
    await lockIdentity(client, profile.authId);

    const { rows: known } = await client.query<{ user_id: string }>(
      "select user_id from user_identities where auth_id = $1",
      [profile.authId],
    );
    if (known[0]) return fillProfile(client, known[0].user_id, profile);

    const { rows: created } = await client.query<{ id: string }>(
      "insert into users (email, avatar_url, display_name) values ($1, $2, $3) returning id",
      [profile.email, profile.avatarUrl, cleanName(profile.name)],
    );
    const userId = created[0].id;
    await client.query("insert into user_identities (auth_id, user_id, provider, email) values ($1, $2, $3, $4)", [
      profile.authId,
      userId,
      profile.provider,
      profile.email,
    ]);
    await client.query("insert into ai_settings (user_id) values ($1) on conflict do nothing", [userId]);
    return fillProfile(client, userId, profile);
  });
}

export async function attachSocial(userId: string, profile: SocialProfile): Promise<SessionUser> {
  return withTransaction(async (client) => {
    await lockIdentity(client, profile.authId);

    const { rows: mine } = await client.query("select 1 from users where id = $1 for update", [userId]);
    if (mine.length === 0) throw notFound("Usuario");

    const { rows: owner } = await client.query<{ user_id: string }>(
      "select user_id from user_identities where auth_id = $1",
      [profile.authId],
    );
    if (owner[0] && owner[0].user_id !== userId) {
      throw conflict(`Esa cuenta de ${profile.provider} ya pertenece a otro usuario de PACT`);
    }

    if (!owner[0]) {
      const { rows: sameProvider } = await client.query(
        "select 1 from user_identities where user_id = $1 and provider = $2",
        [userId, profile.provider],
      );
      if (sameProvider.length > 0) throw conflict(`Ya tienes una cuenta de ${profile.provider} vinculada`);

      await client.query("insert into user_identities (auth_id, user_id, provider, email) values ($1, $2, $3, $4)", [
        profile.authId,
        userId,
        profile.provider,
        profile.email,
      ]);
    }
    return fillProfile(client, userId, profile);
  });
}

export async function listIdentities(userId: string): Promise<IdentityDto[]> {
  const rows = await query<{ provider: string; email: string | null; created_at: Date }>(
    "select provider, email, created_at from user_identities where user_id = $1 order by created_at",
    [userId],
  );
  return rows.map((row) => ({ provider: row.provider, email: row.email, linkedAt: row.created_at.toISOString() }));
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

type SocialRow = UserRow & { headline: string | null; bio: string | null; keywords: string[] };

async function mergeIntoWalletAccount(client: PoolClient, social: SocialRow, walletUserId: string): Promise<SessionUser> {
  await client.query("update user_identities set user_id = $2 where user_id = $1", [social.id, walletUserId]);
  await client.query(
    `insert into user_skills (user_id, skill_id, level)
     select $2, skill_id, level from user_skills where user_id = $1
     on conflict (user_id, skill_id) do nothing`,
    [social.id, walletUserId],
  );
  await client.query("delete from users where id = $1", [social.id]);

  const { rows } = await client.query<UserRow>(
    `update users set
       email = coalesce(email, $2),
       avatar_url = coalesce(avatar_url, $3),
       display_name = coalesce(display_name, $4),
       headline = coalesce(headline, $5),
       bio = coalesce(bio, $6),
       keywords = case when cardinality(keywords) = 0 then $7::text[] else keywords end,
       username = coalesce(username, $8)
     where id = $1
     returning ${USER_COLUMNS}`,
    [walletUserId, social.email, social.avatar_url, social.display_name, social.headline, social.bio, social.keywords, social.username],
  );
  return toSessionUser(rows[0], "session");
}

export async function linkWallet(userId: string, wallet: string, signature: string): Promise<LinkWalletResult> {
  if (!(await consumeChallenge(wallet, signature))) {
    throw new ApiError(401, "invalid_signature", "La firma no es válida o el reto expiró");
  }

  return withTransaction(async (client) => {
    const { rows: mine } = await client.query<SocialRow>(
      `select ${USER_COLUMNS}, headline, bio, keywords from users where id = $1 for update`,
      [userId],
    );
    const me = mine[0];
    if (!me) throw notFound("Usuario");

    if (me.wallet === wallet) return { user: toSessionUser(me, "session"), merged: false };
    if (me.wallet) throw conflict("Tu cuenta ya tiene otra wallet vinculada");

    const { rows: others } = await client.query<{ id: string; has_identity: boolean }>(
      `select id, exists (select 1 from user_identities i where i.user_id = users.id) as has_identity
         from users where wallet = $1 for update`,
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

    if (other.has_identity) throw conflict("Esa wallet ya está vinculada a otra cuenta de PACT");
    if (await hasActivity(client, userId)) {
      throw conflict("Tu cuenta ya tiene actividad y esa wallet también; no se pueden unir automáticamente");
    }

    return { user: await mergeIntoWalletAccount(client, me, other.id), merged: true };
  });
}
