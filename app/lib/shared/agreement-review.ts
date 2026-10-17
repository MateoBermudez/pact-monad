import { z } from "zod";

export const reviewSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  amount: z
    .string()
    .regex(/^\d+(?:[.,]\d{1,6})?$/)
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number().positive().max(5_000_000)),
  days: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(365)),
  provider: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .refine((v) => !/^0x0{40}$/i.test(v)),
});

export const reviewListingSchema = reviewSchema.omit({ provider: true });

export const MIN_RULE_LENGTH = 5;
export const MAX_RULE_LENGTH = 300;
export const MAX_RULES = 12;
export const FALLBACK_RULE = "La entrega cumple íntegramente la descripción, los entregables y los formatos confirmados en la solicitud";

export function parseRuleLines(text: string): { rules: string[]; error: string | null } {
  const rules = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rules.length > MAX_RULES) return { rules, error: `Escribe como máximo ${MAX_RULES} condiciones.` };
  if (rules.some((rule) => rule.length < MIN_RULE_LENGTH || rule.length > MAX_RULE_LENGTH)) {
    return { rules, error: `Cada condición debe tener de ${MIN_RULE_LENGTH} a ${MAX_RULE_LENGTH} caracteres.` };
  }
  return { rules, error: null };
}

export function providerError(
  provider: string,
  client?: string,
): string | null {
  const value = provider.trim();
  if (!value) return "Añade la wallet del proveedor para continuar.";
  if (!/^0x[0-9a-fA-F]{40}$/.test(value))
    return "Introduce una dirección válida: 0x y 40 caracteres hexadecimales.";
  if (/^0x0{40}$/i.test(value))
    return "La wallet del proveedor no puede ser la dirección cero.";
  if (client && value.toLowerCase() === client.toLowerCase())
    return "Cliente y proveedor deben tener wallets distintas.";
  return null;
}
