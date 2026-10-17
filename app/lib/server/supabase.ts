import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/server/env";

const FLOW_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export async function createSupabaseAuthClient() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY");
  }

  const store = await cookies();
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          const maxAge = options.maxAge && options.maxAge > 0 ? Math.min(options.maxAge, FLOW_COOKIE_MAX_AGE_SECONDS) : options.maxAge;
          store.set(name, value, {
            ...options,
            maxAge,
            expires: maxAge === undefined ? options.expires : undefined,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      },
    },
  });
}
