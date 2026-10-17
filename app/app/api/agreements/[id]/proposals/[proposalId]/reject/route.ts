import { authed, parseId } from "@/lib/server/http";
import { resolveProposal } from "@/lib/server/services/chat";

export const POST = authed<{ id: string; proposalId: string }>(async ({ params, user }) => ({
  message: await resolveProposal(user, parseId(params.id), parseId(params.proposalId), "reject"),
}));
