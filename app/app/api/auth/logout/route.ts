import { unstable_rethrow } from "next/navigation";
import { endSession } from "@/lib/server/auth";

export async function POST() {
  try {
    await endSession();
    return Response.json({ ok: true });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth/logout]", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
