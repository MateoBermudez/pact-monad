alter table users add column roles text[] not null default '{}' check (roles <@ array['client', 'provider']);

update users set roles = array['client', 'provider'];

create table notifications (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  type text not null,
  listing_id uuid references listings (id) on delete cascade,
  title text not null,
  body text,
  data jsonb not null default '{}',
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe_key)
);
create index notifications_user_recent on notifications (user_id, id desc);
create index notifications_unread on notifications (user_id) where read_at is null;
alter table notifications enable row level security;
