import "server-only";

export const serverEnv = {
  aiApiUrl: process.env.AI_API_URL ?? "http://127.0.0.1:8000",
  aiApiSecret: process.env.AI_API_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? 5),
  dbSslCa: process.env.DB_SSL_CA,
  rpcUrl: process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  contractDeployBlock: Number(process.env.CONTRACT_DEPLOY_BLOCK ?? 0),
  indexerBlockTag: process.env.INDEXER_BLOCK_TAG === "latest" ? "latest" : "finalized",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "pact-files",
  treasuryAddress: (process.env.TREASURY_ADDRESS ?? "").toLowerCase(),
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY ?? "",
  creditPriceMon: process.env.CREDIT_PRICE_MON ?? "0.1",
  monthlyFreeCredits: Number(process.env.MONTHLY_FREE_CREDITS ?? 20),
} as const;
