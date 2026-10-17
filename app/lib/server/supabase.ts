import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/server/env";

export async function createSupabaseAuthClient() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY");
  }

  const store = await cookies();
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) store.set(name, value, options);
      },
    },
  });
}
