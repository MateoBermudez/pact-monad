import { callAi } from "@/lib/server/ai";
import type { StructureAgreementRequest, StructureAgreementResponse } from "@/lib/shared/pact";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<StructureAgreementRequest> | null;
  if (typeof body?.text !== "string" || body.text.trim() === "") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await callAi<StructureAgreementResponse>("/structure-agreement", { text: body.text });
    return Response.json(result);
  } catch {
    return Response.json({ error: "ai_unavailable" }, { status: 502 });
  }
}
