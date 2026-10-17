// Conecta Supabase con la app desplegada: guarda el secreto en Vault, la URL del worker y programa pg_cron.
//   pnpm db:webhooks -- --url https://mi-app.vercel.app          configura (y genera el secreto si no existe)
//   pnpm db:webhooks -- --url … --interval 10 --rotate           intervalo en segundos (5-59) y secreto nuevo
//   pnpm db:webhooks -- --status                                 muestra la configuración y las últimas llamadas
//   pnpm db:webhooks -- --off                                    apaga la tarea programada y borra la URL
import { randomBytes } from "node:crypto";
import pg from "pg";

const JOB_NAME = "pact-worker";
const SECRET_NAME = "pact_internal_secret";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const url = process.env.DATABASE_URL_SESSION;
if (!url) {
  console.error("Falta DATABASE_URL_SESSION (usa: pnpm db:webhooks, que carga .env.local).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const q = async <T extends pg.QueryResultRow>(text: string, params?: unknown[]) => (await client.query<T>(text, params)).rows;

async function readSecret(): Promise<{ id: string; secret: string } | null> {
  const [row] = await q<{ id: string; decrypted_secret: string }>(
    "select id, decrypted_secret from vault.decrypted_secrets where name = $1 limit 1",
    [SECRET_NAME],
  );
  return row ? { id: row.id, secret: row.decrypted_secret } : null;
}

async function status(): Promise<void> {
  const [setting] = await q<{ value: string }>("select value from public.app_settings where key = 'worker_url'");
  const secret = await readSecret();
  const [job] = await q<{ jobid: string; schedule: string; active: boolean }>(
    "select jobid::text, schedule, active from cron.job where jobname = $1",
    [JOB_NAME],
  );
  console.log(`URL del worker : ${setting?.value ?? "(sin configurar)"}`);
  console.log(`Secreto        : ${secret ? "guardado en Vault (no se muestra; usa --show-secret)" : "(sin configurar)"}`);
  console.log(`Tarea pg_cron  : ${job ? `${job.schedule} · ${job.active ? "activa" : "pausada"}` : "(no programada)"}`);

  if (job) {
    const runs = await q<{ status: string; return_message: string | null; start_time: Date }>(
      "select status, return_message, start_time from cron.job_run_details where jobid = $1::bigint order by start_time desc limit 3",
      [job.jobid],
    );
    for (const run of runs) console.log(`  cron ${run.start_time.toISOString().slice(11, 19)}  ${run.status}  ${run.return_message ?? ""}`);
  }
  const responses = await q<{ status_code: number | null; error_msg: string | null; created: Date }>(
    "select status_code, error_msg, created from net._http_response order by id desc limit 3",
  );
  for (const response of responses) {
    console.log(`  http ${response.created.toISOString().slice(11, 19)}  ${response.status_code ?? "sin respuesta"}  ${response.error_msg ?? ""}`);
  }
}

async function off(): Promise<void> {
  await q("select cron.unschedule(jobid) from cron.job where jobname = $1", [JOB_NAME]);
  await q("delete from public.app_settings where key = 'worker_url'");
  if (flag("forget-secret")) await q("delete from vault.secrets where name = $1", [SECRET_NAME]);
  console.log("Apagado: tarea programada eliminada y URL borrada. El secreto sigue en Vault (--forget-secret lo borra).");
}

async function configure(rawUrl: string): Promise<void> {
  let origin: URL;
  try {
    origin = new URL(rawUrl);
  } catch {
    throw new Error("--url no es una URL válida");
  }
  if (origin.protocol !== "https:") throw new Error("--url debe ser https: Supabase no puede llamar a localhost ni a http");

  const interval = Number(option("interval") ?? 10);
  if (!Number.isInteger(interval) || interval < 5 || interval > 59) throw new Error("--interval va de 5 a 59 segundos");

  const workerUrl = `${origin.origin}${option("path") ?? "/api/internal/worker"}`;

  const existing = await readSecret();
  let secret = existing?.secret ?? null;
  let generated = false;
  if (!existing) {
    secret = randomBytes(32).toString("base64url");
    await q("select vault.create_secret($1, $2, $3)", [secret, SECRET_NAME, "Secreto con el que la base llama al worker de PACT"]);
    generated = true;
  } else if (flag("rotate")) {
    secret = randomBytes(32).toString("base64url");
    await q("select vault.update_secret($1::uuid, $2)", [existing.id, secret]);
    generated = true;
  }

  await q(
    `insert into public.app_settings (key, value) values ('worker_url', $1)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [workerUrl],
  );
  await q("select cron.schedule($1, $2, 'select public.pact_call_worker(true)')", [JOB_NAME, `${interval} seconds`]);

  console.log(`URL del worker : ${workerUrl}`);
  console.log(`Tarea pg_cron  : cada ${interval} s (${JOB_NAME})`);
  if (generated || flag("show-secret")) {
    console.log(`\nSecreto${generated ? " NUEVO" : ""} — pégalo en Vercel como INTERNAL_WEBHOOK_SECRET:\n  ${secret}\n`);
  } else {
    console.log("Secreto        : el existente (no se muestra; usa --show-secret)");
  }

  // Llamada de prueba: se ve de inmediato si la app responde y si el secreto coincide.
  const [{ last }] = await q<{ last: string }>("select coalesce(max(id), 0)::text as last from net._http_response");
  await q("select public.pact_call_worker(true)");
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const [response] = await q<{ status_code: number | null; error_msg: string | null; timed_out: boolean | null; content: string | null }>(
      "select status_code, error_msg, timed_out, left(content, 160) as content from net._http_response where id > $1::bigint order by id limit 1",
      [last],
    );
    if (!response) continue;
    const meaning =
      response.status_code === 200 ? "la app respondió: todo conectado"
      : response.status_code === 401 ? "la app respondió 401: INTERNAL_WEBHOOK_SECRET en Vercel no coincide con este secreto"
      : response.status_code === 503 ? "la app respondió 503: falta INTERNAL_WEBHOOK_SECRET en Vercel"
      : response.error_msg ?? `respuesta inesperada ${response.status_code}`;
    console.log(`Prueba         : HTTP ${response.status_code ?? "—"} · ${meaning}`);
    return;
  }
  console.log("Prueba         : sin respuesta en 10 s (¿la app está desplegada y accesible públicamente?)");
}

try {
  if (flag("status")) await status();
  else if (flag("off")) await off();
  else if (option("url")) await configure(option("url") as string);
  else console.log("Uso: pnpm db:webhooks -- --url https://mi-app.vercel.app | --status | --off");
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
