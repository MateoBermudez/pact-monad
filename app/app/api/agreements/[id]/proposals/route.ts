import { authed, parseId, readJson } from "@/lib/server/http";
import { createProposal } from "@/lib/server/services/chat";
import { createProposalSchema } from "@/lib/shared/schemas";

export const POST = authed<{ id: string }>(async ({ request, params, user }) => ({
  message: await createProposal(user, parseId(params.id), await readJson(request, createProposalSchema)),
}));
