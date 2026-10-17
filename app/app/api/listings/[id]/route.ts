import { authed, parseId, readJson } from "@/lib/server/http";
import { getListing, updateListing } from "@/lib/server/services/listings";
import { updateListingSchema } from "@/lib/shared/schemas";

export const GET = authed<{ id: string }>(async ({ params, user }) => ({
  listing: await getListing(user, parseId(params.id)),
}));

export const PATCH = authed<{ id: string }>(async ({ request, params, user }) => ({
  listing: await updateListing(user, parseId(params.id), await readJson(request, updateListingSchema)),
}));
