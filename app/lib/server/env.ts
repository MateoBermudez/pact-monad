import "server-only";

export const serverEnv = {
  aiApiUrl: process.env.AI_API_URL ?? "http://127.0.0.1:8000",
  aiApiSecret: process.env.AI_API_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  // En Vercel cada instancia es una función aparte: pocas conexiones por instancia, el pooler de Supabase hace el resto.
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 2 : 5)),
  dbSslCa: process.env.DB_SSL_CA,
  rpcUrl: process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  contractDeployBlock: Number(process.env.CONTRACT_DEPLOY_BLOCK ?? 0),
  indexerBlockTag: process.env.INDEXER_BLOCK_TAG === "latest" ? "latest" : "finalized",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "pact-files",
  treasuryAddress: (process.env.TREASURY_ADDRESS ?? "").toLowerCase(),
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY ?? "",
  // Secreto con el que Supabase (pg_cron y webhooks de la base) llama a /api/internal/worker. Sin él, el endpoint está apagado.
  internalSecret: process.env.INTERNAL_WEBHOOK_SECRET ?? "",
  // Cron de Vercel: envía "Authorization: Bearer <CRON_SECRET>".
  cronSecret: process.env.CRON_SECRET ?? "",
  // Solo para desarrollo y pruebas: permite webhooks hacia localhost. Se ignora en producción.
  webhookAllowPrivate: process.env.NODE_ENV !== "production" && process.env.WEBHOOK_ALLOW_PRIVATE === "1",
  creditPriceMon: process.env.CREDIT_PRICE_MON ?? "0.1",
  monthlyFreeCredits: Number(process.env.MONTHLY_FREE_CREDITS ?? 20),
} as const;
