import { authed, readJson, readQuery } from "@/lib/server/http";
import { createListing, listListings } from "@/lib/server/services/listings";
import { createListingSchema, listListingsQuerySchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ request, user }) => ({
  listings: await listListings(user, readQuery(request, listListingsQuerySchema)),
}));

export const POST = authed(async ({ request, user }) => ({
  listing: await createListing(user, await readJson(request, createListingSchema)),
}));
