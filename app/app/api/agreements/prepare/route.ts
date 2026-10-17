import { authed, readJson } from "@/lib/server/http";
import { prepareDirectAgreement } from "@/lib/server/services/direct-agreements";
import { directAgreementSchema } from "@/lib/shared/direct-agreement";

export const POST = authed(async ({ request, user }) => ({ agreement: await prepareDirectAgreement(user, await readJson(request, directAgreementSchema)) }));
