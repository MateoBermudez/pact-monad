-- Hora real del bloque de cada evento. Sirve para el historial del panel y para no avisar de eventos antiguos al reindexar.
alter table chain_events add column block_time timestamptz;
