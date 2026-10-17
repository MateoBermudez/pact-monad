import { z } from "zod";

export const reviewSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  amount: z
    .string()
    .regex(/^\d+(?:[.,]\d{1,6})?$/)
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number().positive().max(5_000_000)),
  days: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(365)),
  provider: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .refine((v) => !/^0x0{40}$/i.test(v)),
});

export function providerError(provider: string, client?: string): string | null {
  const value = provider.trim();
  if (!value) return "Añade la wallet del proveedor para continuar.";
  if (!/^0x[0-9a-fA-F]{40}$/.test(value))
    return "Introduce una dirección válida: 0x y 40 caracteres hexadecimales.";
  if (/^0x0{40}$/i.test(value)) return "La wallet del proveedor no puede ser la dirección cero.";
  if (client && value.toLowerCase() === client.toLowerCase())
    return "Cliente y proveedor deben tener wallets distintas.";
  return null;
}

const listingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  budgetMon: z.string().nullable(),
  deadlineDays: z.number().nullable(),
});

/** Next.js owns AI access and session cookies; no direct call to pact-ai. */
export async function structureAgreement(text: string) {
  const base = (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
  async function post(path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Inicia sesión para estructurar tu acuerdo con IA."
          : "No pudimos estructurar el acuerdo. Inténtalo de nuevo o completa los campos manualmente.",
      );
    return response.json();
  }
  const draft = z
    .object({ listing: listingSchema })
    .parse(await post("/api/listings", { description: text }));
  return z
    .object({ listing: listingSchema, source: z.enum(["ai", "fallback"]) })
    .parse(await post(`/api/listings/${draft.listing.id}/structure`));
}
