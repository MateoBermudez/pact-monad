-- Un borrador de solicitud puede existir sin monto ni plazo: la IA los propone después.
alter table listings alter column budget_mon drop not null;
alter table listings alter column deadline_days drop not null;
alter table listings add constraint listings_ready_check
  check (status = 'draft' or (budget_mon is not null and deadline_days is not null));

-- El hash de las reglas confirmadas identifica la solicitud on-chain: no puede repetirse.
create unique index listings_rules_hash_unique on listings (rules_hash) where rules_hash is not null;

-- Una solicitud solo puede tener un acuerdo activo a la vez.
create unique index agreements_one_active_per_listing on agreements (listing_id)
  where listing_id is not null and status <> 'Cancelled';

-- Reserva para que la IA revise una misma entrega una sola vez, aunque lleguen varias peticiones a la vez.
create table review_runs (
  agreement_id uuid not null references agreements (id) on delete cascade,
  input_hash text not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  created_at timestamptz not null default now(),
  primary key (agreement_id, input_hash)
);
alter table review_runs enable row level security;

-- Permite saber si una decisión de la IA llegó a ejecutarse on-chain (evento AgentReleased con su hash).
create index chain_events_decision on chain_events ((data ->> 'decisionHash')) where event = 'AgentReleased';
