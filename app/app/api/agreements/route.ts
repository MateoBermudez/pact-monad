import { authed } from "@/lib/server/http";
import { listAgreementsFor } from "@/lib/server/services/agreements";

export const GET = authed(async ({ user }) => ({ agreements: await listAgreementsFor(user.id) }));
