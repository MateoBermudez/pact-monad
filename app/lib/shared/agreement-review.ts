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
