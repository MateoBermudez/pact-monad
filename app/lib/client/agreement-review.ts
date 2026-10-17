import "client-only";
import { ensureSession } from "./auth";
import { api, jsonRequest } from "./api";
import type { ListingDto, StructureResultDto } from "@/lib/shared/listings";
export { providerError, reviewSchema } from "@/lib/shared/agreement-review";

export async function structureAgreement(
  text: string,
): Promise<StructureResultDto> {
  await ensureSession();
  const { listing } = await api<{ listing: ListingDto }>(
    "/api/listings",
    jsonRequest("POST", { description: text }),
  );
  return api<StructureResultDto>(`/api/listings/${listing.id}/structure`, {
    method: "POST",
  });
}
