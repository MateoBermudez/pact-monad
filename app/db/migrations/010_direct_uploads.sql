-- Subida directa al Storage: el archivo se registra como "pending" al pedir la URL y pasa a "ready" cuando el
-- servidor comprueba lo que realmente llegó (tamaño, tipo por contenido y hash).
alter table files alter column sha256 drop not null;
alter table files add column status text not null default 'ready' check (status in ('pending', 'ready'));
create index files_pending on files (created_at) where status = 'pending';
