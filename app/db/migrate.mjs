import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL_SESSION;
if (!url) {
  console.error("Falta DATABASE_URL_SESSION (usa: npm run db:migrate, que carga .env.local).");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    alter table schema_migrations enable row level security;
  `);
  const applied = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`= ${file} (ya aplicada)`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`+ ${file}`);
    } catch (error) {
      await client.query("rollback");
      console.error(`x ${file}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
