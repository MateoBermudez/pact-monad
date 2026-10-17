-- Chat entre cliente y proveedor de un acuerdo, con propuestas de cambio de precio o plazo (aceptar / rechazar /
-- contraoferta) que se ejecutan on-chain con `amendAgreement`. Los mensajes son de solo suma: quedan como traza de
-- lo que se negoció. El estado de cada propuesta vive aparte y cambia hasta que el contrato la aplica.

create table agreement_proposals (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references agreements (id) on delete cascade,
  proposer_id uuid not null references users (id),
  old_amount_wei numeric(78, 0) not null check (old_amount_wei > 0),
  new_amount_wei numeric(78, 0) not null check (new_amount_wei > 0),
  -- null conserva el plazo del acuerdo (en el contrato es newDeadline = 0).
  new_deadline timestamptz,
  nonce numeric(78, 0) not null check (nonce >= 0),
  expiry timestamptz not null,
  proposer_signature text not null check (proposer_signature ~ '^0x[0-9a-fA-F]{130}$'),
  -- Solo cuando el proveedor acepta una subida de precio que propuso el cliente: el proveedor firma (sin gas) y es el
  -- cliente quien envía la transacción con los fondos extra.
  acceptor_signature text check (acceptor_signature is null or acceptor_signature ~ '^0x[0-9a-fA-F]{130}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'applied', 'rejected', 'withdrawn', 'superseded')),
  resolved_by uuid references users (id),
  resolved_at timestamptz,
  applied_tx text,
  created_at timestamptz not null default now(),
  check (new_amount_wei <> old_amount_wei or new_deadline is not null)
);
create index agreement_proposals_agreement on agreement_proposals (agreement_id, created_at desc);
-- Una sola propuesta vigente por acuerdo: una nueva reemplaza a la anterior (así funciona la contraoferta).
create unique index agreement_proposals_one_active on agreement_proposals (agreement_id)
  where status in ('pending', 'accepted');

create table agreement_messages (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references agreements (id) on delete cascade,
  -- null en los mensajes del sistema (por ejemplo, "se aplicó el cambio de precio").
  sender_id uuid references users (id),
  kind text not null check (kind in ('text', 'proposal', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  proposal_id uuid references agreement_proposals (id),
  created_at timestamptz not null default now(),
  check ((kind = 'proposal') = (proposal_id is not null)),
  check ((kind = 'system') = (sender_id is null))
);
create index agreement_messages_agreement on agreement_messages (agreement_id, created_at, id);

create trigger agreement_messages_immutable before update on agreement_messages
  for each row execute function forbid_mutation();

alter table agreement_proposals enable row level security;
alter table agreement_messages enable row level security;
revoke all on agreement_proposals, agreement_messages from anon, authenticated;
