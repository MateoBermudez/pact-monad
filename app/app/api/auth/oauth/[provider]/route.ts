import { unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { loginUrl, MODE_COOKIE, RETURN_COOKIE, resolveReturnUrl, withError } from "@/lib/server/return-url";
import { createSupabaseAuthClient } from "@/lib/server/supabase";
import { oauthProviderSchema } from "@/lib/shared/schemas";

const FLOW_COOKIE_TTL_SECONDS = 10 * 60;

export async function GET(request: Request, context: RouteContext<"/api/auth/oauth/[provider]">) {
  const url = new URL(request.url);
  const target = resolveReturnUrl(url.searchParams.get("next"));

  try {
    const provider = oauthProviderSchema.safeParse((await context.params).provider);
    if (!provider.success) return Response.json({ error: "unknown_provider" }, { status: 404 });

    const link = url.searchParams.get("link") === "1";
    const session = await getSessionUser();
    const failure = (code: string) => NextResponse.redirect(withError(session ? target : loginUrl(), code));
    if (session && !link) return failure("already_signed_in");
    if (!session && link) return failure("login_required");

    const supabase = await createSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider.data,
      options: { redirectTo: `${url.origin}/api/auth/callback`, skipBrowserRedirect: true },
    });
    if (error || !data.url) return failure("oauth_unavailable");

    const store = await cookies();
    const flowCookie = {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: FLOW_COOKIE_TTL_SECONDS,
    } as const;
    store.set(RETURN_COOKIE, target.toString(), flowCookie);
    store.set(MODE_COOKIE, link ? "link" : "login", flowCookie);
    return NextResponse.redirect(data.url);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth/oauth]", error);
    return NextResponse.redirect(withError(loginUrl(), "oauth_unavailable"));
  }
}
