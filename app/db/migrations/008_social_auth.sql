alter table users alter column wallet drop not null;

alter table users
  add column auth_id uuid unique references auth.users (id),
  add column email text,
  add column avatar_url text,
  add constraint users_has_identity check (wallet is not null or auth_id is not null);
