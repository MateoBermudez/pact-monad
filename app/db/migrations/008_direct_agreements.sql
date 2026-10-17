-- Acuerdos con proveedor indicado por el cliente, sin simular una postulación del proveedor.
-- El proveedor sigue teniendo que aceptar el acuerdo en el contrato.
create table direct_agreement_intents (
  listing_id uuid primary key references listings(id),
  client_id uuid not null references users(id),
  provider_wallet text not null check (provider_wallet ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now()
);
alter table direct_agreement_intents enable row level security;
