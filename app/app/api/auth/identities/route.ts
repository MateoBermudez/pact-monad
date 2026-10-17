import { authed } from "@/lib/server/http";
import { listIdentities } from "@/lib/server/services/identities";

export const GET = authed(async ({ user }) => ({ identities: await listIdentities(user.id) }));
