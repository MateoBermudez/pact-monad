import { authed, parseId, readJson } from "@/lib/server/http";
import { applyToListing, listApplications } from "@/lib/server/services/applications";
import { applySchema } from "@/lib/shared/schemas";

export const GET = authed<{ id: string }>(async ({ params, user }) => ({
  applications: await listApplications(user, parseId(params.id)),
}));

export const POST = authed<{ id: string }>(async ({ request, params, user }) => ({
  application: await applyToListing(user, parseId(params.id), await readJson(request, applySchema)),
}));
