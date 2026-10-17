import "server-only";
import { AiUnavailableError, structureWithAi, type StructureOutput } from "@/lib/server/ai";
import { pool, withTransaction } from "@/lib/server/db";
import { ApiError, conflict } from "@/lib/server/http";
import { withCredits } from "@/lib/server/services/credits";
import { readFileBytes, requireOwnedFile } from "@/lib/server/services/files";
import { DEFAULT_TITLE, getListing, requireOwnListing } from "@/lib/server/services/listings";
import { saveRulesVersion } from "@/lib/server/services/rules";
import type { SessionUser } from "@/lib/shared/auth";
import { normalizeKeywords } from "@/lib/shared/keywords";
import type { StructureResultDto, StructureSource } from "@/lib/shared/listings";

const FALLBACK_RULES = [
  { criterion: "La entrega cumple lo descrito en la solicitud", weight: 5 },
  { criterion: "La entrega incluye los archivos y formatos pedidos", weight: 4 },
  { criterion: "La entrega llega dentro del plazo acordado", weight: 2 },
];

// Respaldo cuando la IA no responde: extrae monto y plazo del texto con expresiones regulares y usa reglas genéricas.
export function fallbackStructure(text: string): StructureOutput {
  const amount = /(\d+(?:[.,]\d+)?)\s*mon\b/i.exec(text);
  const days = /(\d+)\s*d[ií]as?\b/i.exec(text);
  const weeks = /(\d+)\s*semanas?\b/i.exec(text);
  const firstSentence = text.trim().split(/[.\n]/)[0]?.trim() ?? "";

  return {
    title: firstSentence.slice(0, 80) || DEFAULT_TITLE,
    description: text.trim(),
    amountMon: amount ? Number(amount[1].replace(",", ".")) : null,
    days: days ? Number(days[1]) : weeks ? Number(weeks[1]) * 7 : null,
    category: null,
    keywords: [],
    rules: FALLBACK_RULES,
  };
}

export async function structureListing(user: SessionUser, listingId: string): Promise<StructureResultDto> {
  const listing = await requireOwnListing(pool(), user.id, listingId);
  if (listing.status !== "draft") throw conflict("Solo puedes estructurar una solicitud en borrador");

  const brief = listing.brief_file_id ? await requireOwnedFile(user.id, listing.brief_file_id, "brief") : null;
  const file = brief
    ? { fileName: brief.file_name, mimeType: brief.mime_type, bytes: await readFileBytes(brief) }
    : undefined;
  const text = listing.description ?? undefined;

  let output: StructureOutput;
  let source: StructureSource = "ai";
  try {
    output = await withCredits(user.id, file ? "structureWithFile" : "structure", () => structureWithAi({ text, file }));
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) throw error;
    if (!text) {
      throw new ApiError(502, "ai_unavailable", "No pudimos analizar el archivo ahora. Escribe la descripción o inténtalo de nuevo");
    }
    output = fallbackStructure(text);
    source = "fallback";
  }

  await withTransaction(async (client) => {
    await client.query("select 1 from listings where id = $1 for update", [listingId]);
    const current = await requireOwnListing(client, user.id, listingId);
    if (current.status !== "draft") throw conflict("La solicitud ya no está en borrador");

    // La IA solo rellena lo que el cliente no definió: lo que ya escribió se respeta.
    await client.query(
      `update listings
          set title = case when title = $2 then $3 else title end,
              description = coalesce(description, $4),
              budget_mon = coalesce(budget_mon, $5::numeric),
              deadline_days = coalesce(deadline_days, $6),
              category = coalesce(category, $7),
              keywords = case when cardinality(keywords) = 0 then $8::text[] else keywords end
        where id = $1`,
      [
        listingId,
        DEFAULT_TITLE,
        output.title.slice(0, 120),
        output.description,
        output.amountMon?.toString() ?? null,
        output.days,
        output.category,
        normalizeKeywords(output.keywords),
      ],
    );
    await saveRulesVersion(client, listingId, current.rules_version, output.rules, "ai");
  });

  return { listing: await getListing(user, listingId), source };
}
