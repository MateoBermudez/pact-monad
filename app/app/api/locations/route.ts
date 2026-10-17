import { z } from "zod";
import { authed, readQuery } from "@/lib/server/http";
import { searchLocations } from "@/lib/server/services/locations";

const querySchema = z.object({ q: z.string().trim().min(3).max(80) });

export const GET = authed(async ({ request }) => {
  const { q } = readQuery(request, querySchema);
  return { suggestions: await searchLocations(q) };
});
