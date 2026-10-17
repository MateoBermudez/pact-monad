import "server-only";

export const serverEnv = {
  aiApiUrl: process.env.AI_API_URL ?? "http://127.0.0.1:8000",
} as const;
