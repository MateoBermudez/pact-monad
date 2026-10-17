-- Claves de API para agentes: entran sin cookies ni firmas recurrentes. Solo se guarda el hash; la clave en claro
-- se muestra una única vez al crearla.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_user on api_keys (user_id) where revoked_at is null;
alter table api_keys enable row level security;

-- Sesión deslizante: last_seen_at marca la última renovación.
alter table sessions add column last_seen_at timestamptz not null default now();
