import "client-only";
import { ensureSession } from "./auth";
import { api, jsonRequest } from "./api";
import type { ListingDto, StructureResultDto } from "@/lib/shared/listings";
export { providerError, reviewSchema } from "@/lib/shared/agreement-review";

// La solicitud puede describirse con texto, con un archivo ya subido (PDF, imagen, documento) o con ambos.
export async function structureAgreement(
  text: string,
  briefFileId?: string,
): Promise<StructureResultDto> {
  await ensureSession();
  const { listing } = await api<{ listing: ListingDto }>(
    "/api/listings",
    jsonRequest("POST", {
      ...(text ? { description: text } : {}),
      ...(briefFileId ? { briefFileId } : {}),
    }),
  );
  return api<StructureResultDto>(`/api/listings/${listing.id}/structure`, {
    method: "POST",
  });
}
