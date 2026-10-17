import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { serverEnv } from "@/lib/server/env";

// Una sola piscina por proceso. En desarrollo el hot reload reevalúa los módulos, así que se guarda en globalThis
// para no abrir una piscina nueva (y sus conexiones) en cada recarga.
const globalForDb = globalThis as unknown as { pactPool?: Pool };

function createPool(): Pool {
  if (!serverEnv.databaseUrl) throw new Error("Falta DATABASE_URL");

  const pool = new Pool({
    connectionString: serverEnv.databaseUrl,
    max: serverEnv.dbPoolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    application_name: "pact-app",
    // El pooler de Supabase exige TLS. Sin DB_SSL_CA se cifra pero no se verifica el certificado.
    ssl: serverEnv.dbSslCa ? { ca: serverEnv.dbSslCa } : { rejectUnauthorized: false },
  });
  pool.on("error", (error) => console.error("[db] error en una conexión inactiva:", error.message));
  return pool;
}

export function pool(): Pool {
  return (globalForDb.pactPool ??= createPool());
}

export async function query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}

// El pooler está en modo transacción: la conexión queda fija solo mientras dura la transacción.
// Dentro de fn no se puede depender de estado de sesión (SET, LISTEN, advisory locks de sesión).
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
