create table user_identities (
  auth_id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  provider text not null,
  email text,
  created_at timestamptz not null default now()
);
create index user_identities_user on user_identities (user_id);
create unique index user_identities_one_per_provider on user_identities (user_id, provider);
alter table user_identities enable row level security;

insert into user_identities (auth_id, user_id, provider, email)
select u.auth_id, u.id,
       coalesce((select i.provider from auth.identities i where i.user_id = u.auth_id order by i.created_at limit 1), 'unknown'),
       u.email
  from users u
 where u.auth_id is not null;

alter table users drop constraint users_has_identity;
alter table users drop column auth_id;
