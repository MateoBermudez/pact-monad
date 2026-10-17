import "server-only";

export const serverEnv = {
  aiApiUrl: process.env.AI_API_URL ?? "http://127.0.0.1:8000",
  databaseUrl: process.env.DATABASE_URL ?? "",
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? 5),
  dbSslCa: process.env.DB_SSL_CA,
} as const;
