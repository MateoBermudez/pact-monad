import { unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser, startSession } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/http";
import { loginUrl, MODE_COOKIE, RETURN_COOKIE, resolveReturnUrl, withError } from "@/lib/server/return-url";
import { attachSocial, signInSocial } from "@/lib/server/services/identities";
import { getOnboardingStatus } from "@/lib/server/services/onboarding";
import { toSocialProfile } from "@/lib/server/social-profile";
import { createSupabaseAuthClient } from "@/lib/server/supabase";
import { ONBOARDING_PATH } from "@/lib/shared/routes";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const target = resolveReturnUrl(store.get(RETURN_COOKIE)?.value);
  const linking = store.get(MODE_COOKIE)?.value === "link";
  store.delete({ name: RETURN_COOKIE, path: "/api/auth" });
  store.delete({ name: MODE_COOKIE, path: "/api/auth" });

  const failure = async (code: string) => {
    const signedIn = linking || (await getSessionUser()) !== null;
    return NextResponse.redirect(withError(signedIn ? target : loginUrl(), code));
  };

  try {
    const code = url.searchParams.get("code");
    if (!code) return await failure(url.searchParams.get("error") ?? "oauth_failed");

    const supabase = await createSupabaseAuthClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return await failure("oauth_failed");

    try {
      const profile = toSocialProfile(data.user);
      const current = await getSessionUser();

      if (linking) {
        if (!current) return await failure("login_required");
        await attachSocial(current.id, profile);
        return NextResponse.redirect(target);
      }

      if (current) return await failure("already_signed_in");
      const user = await signInSocial(profile);
      await startSession(user.id);
      const onboarding = await getOnboardingStatus(user);
      return NextResponse.redirect(onboarding.complete ? target : new URL(ONBOARDING_PATH, target.origin));
    } finally {
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) return await failure(error.code);
    console.error("[auth/callback]", error);
    return await failure("oauth_failed");
  }
}
