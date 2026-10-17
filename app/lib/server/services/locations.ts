import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/server/http";
import type { LocationSuggestion } from "@/lib/shared/locations";

const resultSchema = z.object({
  features: z.array(z.object({
    properties: z.object({
      osm_id: z.union([z.number(), z.string()]).optional(),
      osm_type: z.string().optional(),
      name: z.string().optional(),
      street: z.string().optional(),
      housenumber: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    }),
  })),
});

export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  try {
    const response = await fetch(url, {
      headers: { "Accept-Language": "es", "User-Agent": "PACT-demo/1.0" },
      signal: AbortSignal.timeout(5000),
      cache: "force-cache",
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("geocoder unavailable");
    const data = resultSchema.parse(await response.json());
    const seen = new Set<string>();
    return data.features.flatMap(({ properties: p }, index) => {
      const street = [p.street, p.housenumber].filter(Boolean).join(" ");
      const parts = [p.name, street, p.city ?? p.district, p.state, p.country];
      const label = [...new Set(parts.filter((part): part is string => Boolean(part)))].join(", ");
      // Profile locations accept at most 80 characters. Never truncate a selected address.
      if (!label || label.length > 80 || seen.has(label)) return [];
      seen.add(label);
      return [{ id: `${p.osm_type ?? "place"}-${p.osm_id ?? index}`, label }];
    });
  } catch {
    throw new ApiError(503, "location_unavailable", "No se pudieron buscar ubicaciones. Puedes escribirla manualmente.");
  }
}
