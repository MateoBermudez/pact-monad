import { authed, parseId } from "@/lib/server/http";
import { closeListing } from "@/lib/server/services/listings";

export const POST = authed<{ id: string }>(async ({ params, user }) => ({
  listing: await closeListing(user, parseId(params.id)),
}));
