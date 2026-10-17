import { authed, parseId } from "@/lib/server/http";
import { publishListing } from "@/lib/server/services/listings";

export const POST = authed<{ id: string }>(async ({ params, user }) => ({
  listing: await publishListing(user, parseId(params.id)),
}));
