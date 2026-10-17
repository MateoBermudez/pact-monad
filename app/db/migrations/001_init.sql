-- PACT: esquema inicial (Supabase / Postgres 17).
-- Todo el acceso pasa por el servidor de Next.js con el rol postgres. RLS queda activado sin políticas,
-- así que la API pública de Supabase (anon / authenticated) no puede leer ni escribir nada.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'La tabla % es de solo lectura (trazabilidad)', tg_table_name;
end $$;

-- ---------------------------------------------------------------------------
-- Usuarios: una sola cuenta puede ser cliente y proveedor a la vez; también agentes de IA.
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  wallet text not null unique check (wallet ~ '^0x[0-9a-f]{40}$'),
  display_name text,
  headline text,
  bio text,
  keywords text[] not null default '{}',
  is_agent boolean not null default false,
  owner_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id is null or is_agent)
);
create index users_keywords_gin on users using gin (keywords);
create trigger users_touch before update on users for each row execute function touch_updated_at();

create table skills (
  id serial primary key,
  slug text not null unique,
  name text not null,
  category text not null
);

create table user_skills (
  user_id uuid not null references users (id) on delete cascade,
  skill_id int not null references skills (id) on delete cascade,
  level smallint not null default 3 check (level between 1 and 5),
  primary key (user_id, skill_id)
);
create index user_skills_skill on user_skills (skill_id);

insert into skills (slug, name, category) values
  ('graphic-design', 'Diseño gráfico', 'Diseño'),
  ('branding', 'Logos e identidad visual', 'Diseño'),
  ('ui-ux', 'Diseño UI/UX', 'Diseño'),
  ('illustration', 'Ilustración', 'Diseño'),
  ('video-editing', 'Edición de video', 'Contenido'),
  ('copywriting', 'Redacción', 'Contenido'),
  ('translation', 'Traducción', 'Contenido'),
  ('marketing', 'Marketing digital', 'Marketing'),
  ('full-stack', 'Desarrollo full stack', 'Programación'),
  ('frontend', 'Desarrollo frontend', 'Programación'),
  ('backend', 'Desarrollo backend y APIs', 'Programación'),
  ('mobile', 'Apps móviles', 'Programación'),
  ('smart-contracts', 'Smart contracts', 'Blockchain'),
  ('security-audit', 'Auditoría de seguridad', 'Blockchain'),
  ('data-ml', 'Datos y machine learning', 'Datos e IA'),
  ('ai-agents', 'Agentes de IA', 'Datos e IA');

-- ---------------------------------------------------------------------------
-- Autenticación con wallet (firma de un mensaje, sin contraseñas)
-- ---------------------------------------------------------------------------

create table auth_nonces (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  message text not null,
  expires_at timestamptz not null
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user on sessions (user_id);
create index sessions_expires on sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Archivos (briefs, portafolio, evidencia). Los bytes viven en Supabase Storage; aquí solo el registro.
-- ---------------------------------------------------------------------------

create table files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('brief', 'portfolio', 'evidence')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  created_at timestamptz not null default now()
);
create index files_owner on files (owner_id);

create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null,
  description text,
  url text,
  file_id uuid references files (id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index portfolio_user on portfolio_items (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Solicitudes de servicio: texto, archivo o ambos
-- ---------------------------------------------------------------------------

create table listings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users (id),
  title text not null,
  description text,
  brief_file_id uuid references files (id) on delete set null,
  category text,
  keywords text[] not null default '{}',
  budget_mon numeric(38, 18) not null check (budget_mon > 0),
  deadline_days int not null check (deadline_days > 0),
  status text not null default 'draft' check (status in ('draft', 'open', 'selecting', 'awarded', 'closed')),
  rules_version int not null default 0,
  rules_confirmed_at timestamptz,
  rules_hash text,
  awarded_application_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (description is not null or brief_file_id is not null)
);
create index listings_open on listings (status, created_at desc);
create index listings_client on listings (client_id);
create index listings_keywords_gin on listings using gin (keywords);
create trigger listings_touch before update on listings for each row execute function touch_updated_at();

-- Reglas de aceptación. La IA las propone (source = 'ai'); el humano las ajusta y cada ajuste crea una versión nueva,
-- de modo que queda constancia de qué reglas estaban vigentes cuando se evaluó una entrega.
create table listing_rules (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  version int not null,
  position int not null,
  criterion text not null,
  weight smallint not null default 1 check (weight between 1 and 5),
  source text not null check (source in ('ai', 'human')),
  created_at timestamptz not null default now(),
  unique (listing_id, version, position)
);

-- ---------------------------------------------------------------------------
-- Postulaciones ("estoy interesado")
-- ---------------------------------------------------------------------------

create table applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  provider_id uuid not null references users (id),
  message text not null,
  price_mon numeric(38, 18) check (price_mon > 0),
  days int check (days > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'rejected', 'selected', 'withdrawn')),
  match_score numeric(5, 2),
  ai_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, provider_id)
);
create index applications_provider on applications (provider_id);
create unique index applications_one_selected on applications (listing_id) where status = 'selected';
create trigger applications_touch before update on applications for each row execute function touch_updated_at();

alter table listings
  add constraint listings_awarded_fk foreign key (awarded_application_id) references applications (id);

create function applications_guard() returns trigger language plpgsql as $$
declare l listings%rowtype;
begin
  select * into l from listings where id = new.listing_id;
  if l.client_id = new.provider_id then
    raise exception 'No puedes postularte a tu propia solicitud';
  end if;
  if tg_op = 'INSERT' and l.status <> 'open' then
    raise exception 'La solicitud no está abierta';
  end if;
  return new;
end $$;
create trigger applications_guard before insert or update on applications
  for each row execute function applications_guard();

-- ---------------------------------------------------------------------------
-- Acuerdos: espejo del contrato en Monad (la fuente de verdad del dinero es la cadena)
-- ---------------------------------------------------------------------------

create table agreements (
  id uuid primary key default gen_random_uuid(),
  chain_agreement_id bigint unique,
  listing_id uuid references listings (id),
  application_id uuid references applications (id),
  client_id uuid not null references users (id),
  provider_id uuid not null references users (id),
  amount_wei numeric(78, 0) not null check (amount_wei > 0),
  deadline timestamptz not null,
  status text not null check (status in ('Created', 'Accepted', 'Delivered', 'Approved', 'Cancelled')),
  rules_hash text,
  evidence_url text,
  provider_note text,
  create_tx text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> provider_id)
);
create index agreements_client on agreements (client_id, status);
create index agreements_provider on agreements (provider_id, status);
create trigger agreements_touch before update on agreements for each row execute function touch_updated_at();

-- Eventos del contrato. unique (tx_hash, log_index) vuelve idempotente al indexador.
create table chain_events (
  id bigserial primary key,
  tx_hash text not null,
  log_index int not null,
  block_number bigint not null,
  chain_agreement_id bigint,
  event text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);
create index chain_events_agreement on chain_events (chain_agreement_id, block_number);

create table chain_sync_state (
  id boolean primary key default true check (id),
  last_block bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into chain_sync_state default values;

-- ---------------------------------------------------------------------------
-- IA: límite de desembolso automático y registro de decisiones
-- ---------------------------------------------------------------------------

-- Apagado por defecto: sin configuración explícita, el cliente firma siempre.
create table ai_settings (
  user_id uuid primary key references users (id) on delete cascade,
  auto_release boolean not null default false,
  auto_release_limit_mon numeric(38, 18) not null default 0 check (auto_release_limit_mon >= 0),
  updated_at timestamptz not null default now()
);
create trigger ai_settings_touch before update on ai_settings for each row execute function touch_updated_at();

-- Registro inmutable de cada evaluación. criteria_results guarda, por criterio, si se cumplió y por qué.
-- decision_hash es el hash canónico de la decisión: es lo que se ancla on-chain al liberar el pago.
create table decisions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references agreements (id),
  kind text not null check (kind in ('recommendation', 'auto_release', 'human_release', 'human_override')),
  decided_by text not null check (decided_by in ('ai', 'human')),
  verdict text not null check (verdict in ('cumple', 'revisar')),
  summary text not null,
  criteria_results jsonb not null,
  rules_version int,
  rules_hash text,
  model text not null,
  input_hash text not null,
  amount_wei numeric(78, 0) not null,
  limit_wei numeric(78, 0),
  decision_hash text not null unique,
  created_at timestamptz not null default now()
);
create index decisions_agreement on decisions (agreement_id, created_at);
create trigger decisions_immutable before update or delete on decisions
  for each row execute function forbid_mutation();
create trigger decisions_no_truncate before truncate on decisions
  for each statement execute function forbid_mutation();

-- ---------------------------------------------------------------------------
-- Calificaciones y reputación (alimentan el ranking de búsqueda)
-- ---------------------------------------------------------------------------

create table ratings (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references agreements (id),
  rater_id uuid not null references users (id),
  ratee_id uuid not null references users (id),
  ratee_role text not null check (ratee_role in ('provider', 'client')),
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agreement_id, rater_id),
  check (rater_id <> ratee_id)
);
create index ratings_ratee on ratings (ratee_id, ratee_role);

create function ratings_guard() returns trigger language plpgsql as $$
declare a agreements%rowtype;
begin
  select * into a from agreements where id = new.agreement_id;
  if a.status <> 'Approved' then
    raise exception 'Solo se puede calificar un acuerdo aprobado';
  end if;
  if not (
    (new.rater_id = a.client_id and new.ratee_id = a.provider_id and new.ratee_role = 'provider')
    or (new.rater_id = a.provider_id and new.ratee_id = a.client_id and new.ratee_role = 'client')
  ) then
    raise exception 'La calificación debe darse entre las dos partes del acuerdo';
  end if;
  return new;
end $$;
create trigger ratings_guard before insert on ratings for each row execute function ratings_guard();

-- Puntaje bayesiano: 5 votos ficticios de 3.5 evitan que un solo 5.0 desbanque a quien tiene decenas de trabajos.
create view user_reputation with (security_invoker = true) as
select
  u.id as user_id,
  count(r.id) filter (where r.ratee_role = 'provider') as provider_ratings,
  round(avg(r.score) filter (where r.ratee_role = 'provider'), 2) as provider_avg,
  round((5 * 3.5 + coalesce(sum(r.score) filter (where r.ratee_role = 'provider'), 0))
        / (5 + count(r.id) filter (where r.ratee_role = 'provider')), 2) as provider_score,
  count(r.id) filter (where r.ratee_role = 'client') as client_ratings,
  round((5 * 3.5 + coalesce(sum(r.score) filter (where r.ratee_role = 'client'), 0))
        / (5 + count(r.id) filter (where r.ratee_role = 'client')), 2) as client_score,
  (select count(*) from agreements a where a.provider_id = u.id and a.status = 'Approved') as completed_as_provider
from users u
left join ratings r on r.ratee_id = u.id
group by u.id;

-- ---------------------------------------------------------------------------
-- Dashboard financiero (montos en wei; el saldo disponible se lee de la wallet)
-- ---------------------------------------------------------------------------

create view user_financials with (security_invoker = true) as
select
  u.id as user_id,
  coalesce(sum(a.amount_wei) filter (where a.client_id = u.id and a.status in ('Created', 'Accepted', 'Delivered')), 0) as locked_wei,
  coalesce(sum(a.amount_wei) filter (where a.provider_id = u.id and a.status in ('Created', 'Accepted', 'Delivered')), 0) as incoming_pending_wei,
  coalesce(sum(a.amount_wei) filter (where a.provider_id = u.id and a.status = 'Approved'), 0) as received_wei,
  coalesce(sum(a.amount_wei) filter (where a.client_id = u.id and a.status = 'Approved'), 0) as paid_wei,
  coalesce(sum(a.amount_wei) filter (where a.client_id = u.id and a.status = 'Cancelled'), 0) as refunded_wei
from users u
left join agreements a on a.client_id = u.id or a.provider_id = u.id
group by u.id;

-- ---------------------------------------------------------------------------
-- Créditos de IA: libro contable de solo suma. El saldo es la suma de los movimientos.
-- ---------------------------------------------------------------------------

create table credit_ledger (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('monthly_grant', 'purchase', 'usage', 'refund', 'adjustment')),
  ref text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index credit_ledger_user on credit_ledger (user_id, created_at desc);

-- Compras de créditos pagadas en MON. tx_hash es la clave: la misma transacción no se acredita dos veces.
create table credit_purchases (
  tx_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  amount_wei numeric(78, 0) not null check (amount_wei > 0),
  credits int not null check (credits > 0),
  created_at timestamptz not null default now()
);

create view credit_balances with (security_invoker = true) as
select u.id as user_id, coalesce(sum(l.delta), 0)::int as balance
from users u
left join credit_ledger l on l.user_id = u.id
group by u.id;

-- Descuento atómico: bloquea la fila del usuario, comprueba el saldo y registra el gasto en un solo paso,
-- para que dos peticiones simultáneas no gasten dos veces los mismos créditos.
create function spend_credits(p_user uuid, p_amount int, p_ref text, p_meta jsonb default '{}')
returns int language plpgsql as $$
declare bal int;
begin
  if p_amount <= 0 then
    raise exception 'La cantidad debe ser positiva';
  end if;
  perform 1 from users where id = p_user for update;
  select coalesce(sum(delta), 0) into bal from credit_ledger where user_id = p_user;
  if bal < p_amount then
    raise exception 'insufficient_credits';
  end if;
  insert into credit_ledger (user_id, delta, reason, ref, meta) values (p_user, -p_amount, 'usage', p_ref, p_meta);
  return bal - p_amount;
end $$;

-- ---------------------------------------------------------------------------
-- Seguridad: RLS activado sin políticas y sin permisos para los roles de la API pública
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
