import { callAi } from "@/lib/server/ai";
import type { ReviewEvidenceRequest, ReviewEvidenceResponse } from "@/lib/shared/pact";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ReviewEvidenceRequest> | null;
  if (
    typeof body?.requirements !== "string" ||
    typeof body.provider_note !== "string" ||
    typeof body.evidence_url !== "string"
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await callAi<ReviewEvidenceResponse>("/review-evidence", {
      requirements: body.requirements,
      provider_note: body.provider_note,
      evidence_url: body.evidence_url,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "ai_unavailable" }, { status: 502 });
  }
}
