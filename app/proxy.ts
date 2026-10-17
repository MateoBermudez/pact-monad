import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/shared/auth";
import { decideRoute } from "@/lib/shared/routes";

export function proxy(request: NextRequest) {
  const target = decideRoute(request.nextUrl.pathname, request.cookies.has(SESSION_COOKIE));
  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
