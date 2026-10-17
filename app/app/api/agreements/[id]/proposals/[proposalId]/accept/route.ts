import { authed, parseId, readJson } from "@/lib/server/http";
import { acceptProposal } from "@/lib/server/services/chat";
import { acceptProposalSchema } from "@/lib/shared/schemas";

export const POST = authed<{ id: string; proposalId: string }>(async ({ request, params, user }) => ({
  message: await acceptProposal(user, parseId(params.id), parseId(params.proposalId), await readJson(request, acceptProposalSchema)),
}));
