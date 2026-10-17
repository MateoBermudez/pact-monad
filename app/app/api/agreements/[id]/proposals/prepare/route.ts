import { authed, parseId, readJson } from "@/lib/server/http";
import { prepareProposal } from "@/lib/server/services/chat";
import { prepareProposalSchema } from "@/lib/shared/schemas";

export const POST = authed<{ id: string }>(async ({ request, params, user }) => ({
  prepared: await prepareProposal(user, parseId(params.id), await readJson(request, prepareProposalSchema)),
}));
