import { unstable_rethrow } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
    return Response.json({ user });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth/me]", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
