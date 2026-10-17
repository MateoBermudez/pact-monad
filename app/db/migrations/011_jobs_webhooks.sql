-- Cola de trabajos (patrón "outbox"): el indexador anota el trabajo pendiente en la MISMA transacción en la que
-- registra el evento, así que nunca se pierde. Un worker lo reclama con FOR UPDATE SKIP LOCKED.
-- "Reclamar" no cambia el estado: empuja run_after hacia adelante (un contrato de arrendamiento). Si el worker muere,
-- el trabajo vuelve a estar disponible solo cuando vence ese plazo.
create table jobs (
  id bigserial primary key,
  kind text not null check (kind in ('review_delivery')),
  payload jsonb not null,
  dedupe_key text unique,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_ready on jobs (run_after) where status = 'pending';

-- Webhooks salientes: las personas y los agentes registran una URL y reciben un aviso firmado cuando algo les
-- toca (entrega registrada, acuerdo aceptado, pago liberado...). La firma exige guardar el secreto en claro; la tabla
-- tiene RLS sin políticas, así que solo el servidor la lee.
create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  url text not null check (char_length(url) <= 512),
  secret text not null,
  events text[] not null default '{}',
  active boolean not null default true,
  consecutive_failures int not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now()
);
create index webhook_endpoints_user on webhook_endpoints (user_id);

create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references webhook_endpoints (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  dedupe_key text,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  response_status int,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (endpoint_id, dedupe_key)
);
create index webhook_deliveries_ready on webhook_deliveries (next_attempt_at) where status = 'pending';
create index webhook_deliveries_endpoint on webhook_deliveries (endpoint_id, created_at desc);

alter table jobs enable row level security;
alter table webhook_endpoints enable row level security;
alter table webhook_deliveries enable row level security;
