-- Los ids de acuerdo se reinician con cada despliegue del contrato. Para que un redespliegue no choque con los datos
-- anteriores, cada acuerdo y cada evento guardan la dirección del contrato al que pertenecen.

alter table agreements add column contract_address text;
alter table agreements add column description text;
alter table chain_events add column contract_address text;
alter table chain_sync_state add column contract_address text;

alter table agreements alter column contract_address set not null;
alter table chain_events alter column contract_address set not null;

alter table agreements add constraint agreements_contract_address_check check (contract_address ~ '^0x[0-9a-f]{40}$');
alter table agreements drop constraint agreements_chain_agreement_id_key;
alter table agreements add constraint agreements_contract_chain_id_key unique (contract_address, chain_agreement_id);

drop index chain_events_agreement;
create index chain_events_agreement on chain_events (contract_address, chain_agreement_id, block_number);
