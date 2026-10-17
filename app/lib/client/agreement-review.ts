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

export type PublishListingInput = {
  listingId?: string;
  title: string;
  description: string;
  amountMon: number;
  days: number;
  keywords: string[];
  rules: { criterion: string; weight: number }[];
};

// Publicar no bloquea fondos ni pide wallet: crea o actualiza el borrador, confirma las condiciones y abre la oportunidad.
export async function publishListing(input: PublishListingInput, onDraft: (id: string) => void): Promise<string> {
  await ensureSession();
  const fields = {
    title: input.title,
    description: input.description,
    budgetMon: input.amountMon,
    deadlineDays: input.days,
    keywords: input.keywords,
  };
  let id = input.listingId;
  if (id) {
    await api(`/api/listings/${id}`, jsonRequest("PATCH", fields));
  } else {
    const { listing } = await api<{ listing: ListingDto }>("/api/listings", jsonRequest("POST", fields));
    id = listing.id;
    onDraft(id);
  }
  await api(`/api/listings/${id}/rules`, jsonRequest("PUT", { rules: input.rules }));
  await api(`/api/listings/${id}/publish`, { method: "POST" });
  return id;
}
