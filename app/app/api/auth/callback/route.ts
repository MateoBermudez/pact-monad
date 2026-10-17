import { unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser, startSession } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/http";
import { RETURN_COOKIE, resolveReturnUrl, withError } from "@/lib/server/return-url";
import { attachSocial, signInSocial } from "@/lib/server/services/identities";
import { toSocialProfile } from "@/lib/server/social-profile";
import { createSupabaseAuthClient } from "@/lib/server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const target = resolveReturnUrl(store.get(RETURN_COOKIE)?.value);
  store.delete({ name: RETURN_COOKIE, path: "/api/auth" });

  const failure = (code: string) => NextResponse.redirect(withError(target, code));

  try {
    const code = url.searchParams.get("code");
    if (!code) return failure(url.searchParams.get("error") ?? "oauth_failed");

    const supabase = await createSupabaseAuthClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return failure("oauth_failed");

    const profile = toSocialProfile(data.user);
    const current = await getSessionUser();
    if (current) {
      await attachSocial(current.id, profile);
    } else {
      const user = await signInSocial(profile);
      await startSession(user.id);
    }

    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(target);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return failure(error.code);
    console.error("[auth/callback]", error);
    return failure("oauth_failed");
  }
}
