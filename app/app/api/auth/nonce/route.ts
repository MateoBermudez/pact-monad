import { issueChallenge, parseAddress } from "@/lib/server/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: unknown } | null;
  const wallet = parseAddress(body?.address);
  if (!wallet) return Response.json({ error: "invalid_address" }, { status: 400 });

  try {
    const message = await issueChallenge(wallet, new URL(request.url));
    return Response.json({ message });
  } catch (error) {
    console.error("[auth/nonce]", error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
