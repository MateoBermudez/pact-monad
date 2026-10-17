-- La base despierta al worker de la app: pg_cron lo llama cada pocos segundos y un disparador lo llama al instante cuando
-- entra trabajo nuevo. Así nada depende de que alguien tenga la app abierta ni del cron de Vercel.
-- La URL y el secreto NO van aquí: los configura `pnpm db:webhooks`. Mientras no estén, todo es un no-op.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- Llama a POST <worker_url> con el secreto guardado en Vault. pg_net encola la petición y la envía al confirmarse la
-- transacción, así que un disparador nunca despierta al worker antes de que el trabajo sea visible.
create function public.pact_call_worker(sync boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare
  worker_url text;
  worker_secret text;
begin
  select value into worker_url from public.app_settings where key = 'worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'pact_internal_secret' limit 1;
  if worker_url is null or worker_secret is null then
    return;
  end if;
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-pact-secret', worker_secret),
    body := jsonb_build_object('sync', sync),
    timeout_milliseconds := 5000
  );
end $$;

create function public.pact_notify_work() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.pact_call_worker(false);
  return null;
end $$;

create trigger jobs_notify after insert on jobs for each statement execute function public.pact_notify_work();
create trigger webhook_deliveries_notify after insert on webhook_deliveries for each statement execute function public.pact_notify_work();

-- Solo el servidor puede ejecutarlas; la API pública de Supabase no.
revoke all on function public.pact_call_worker(boolean) from public, anon, authenticated;
revoke all on function public.pact_notify_work() from public, anon, authenticated;
