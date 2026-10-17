import { unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RETURN_COOKIE, resolveReturnUrl, withError } from "@/lib/server/return-url";
import { createSupabaseAuthClient } from "@/lib/server/supabase";
import { oauthProviderSchema } from "@/lib/shared/schemas";

const RETURN_COOKIE_TTL_SECONDS = 10 * 60;

export async function GET(request: Request, context: RouteContext<"/api/auth/oauth/[provider]">) {
  const url = new URL(request.url);
  const failure = (code: string) => NextResponse.redirect(withError(resolveReturnUrl(null), code));

  try {
    const provider = oauthProviderSchema.safeParse((await context.params).provider);
    if (!provider.success) return Response.json({ error: "unknown_provider" }, { status: 404 });

    const supabase = await createSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider.data,
      options: { redirectTo: `${url.origin}/api/auth/callback`, skipBrowserRedirect: true },
    });
    if (error || !data.url) return failure("oauth_unavailable");

    (await cookies()).set(RETURN_COOKIE, resolveReturnUrl(url.searchParams.get("next")).toString(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: RETURN_COOKIE_TTL_SECONDS,
    });
    return NextResponse.redirect(data.url);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth/oauth]", error);
    return failure("oauth_unavailable");
  }
}
