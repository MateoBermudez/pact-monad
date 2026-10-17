import { authed, readQuery } from "@/lib/server/http";
import { searchProviders } from "@/lib/server/services/providers";
import { providersQuerySchema } from "@/lib/shared/schemas";

export const GET = authed(async ({ request, user }) => ({
  providers: await searchProviders(user, readQuery(request, providersQuerySchema)),
}));
