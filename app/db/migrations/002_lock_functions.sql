-- Postgres concede EXECUTE a PUBLIC por defecto, y anon/authenticated lo heredan. Sin esto, la API REST pública de
-- Supabase podría invocar funciones como spend_credits. Solo el servidor (rol postgres) debe ejecutarlas.

revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
