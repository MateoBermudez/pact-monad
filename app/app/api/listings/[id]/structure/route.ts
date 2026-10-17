import { authed, parseId } from "@/lib/server/http";
import { structureListing } from "@/lib/server/services/structure";

export const POST = authed<{ id: string }>(async ({ params, user }) => structureListing(user, parseId(params.id)));
