import { unstable_rethrow } from "next/navigation";
import { isSignature, parseAddress, startSession, verifyChallenge } from "@/lib/server/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: unknown; signature?: unknown } | null;
  const wallet = parseAddress(body?.address);
  if (!wallet || !isSignature(body?.signature)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const user = await verifyChallenge(wallet, body.signature);
    if (!user) return Response.json({ error: "invalid_signature" }, { status: 401 });

    await startSession(user.id);
    return Response.json({ user });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth/verify]", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
