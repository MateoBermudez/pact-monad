import { z } from "zod";
import { FILE_PURPOSES } from "@/lib/shared/files";

export const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Hash de transacción inválido");

export const uuidSchema = z.string().uuid();

export const purchaseCreditsSchema = z.object({ txHash: txHashSchema });

export const filePurposeSchema = z.enum(FILE_PURPOSES);

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).nullable().optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  keywords: z.array(z.string().max(60)).max(40).optional(),
  skills: z
    .array(z.object({ slug: z.string().min(1).max(40), level: z.number().int().min(1).max(5).default(3) }))
    .max(20)
    .optional(),
  isAgent: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const createPortfolioItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  url: z.string().url().max(512).optional(),
  fileId: uuidSchema.optional(),
  tags: z.array(z.string().max(60)).max(20).default([]),
});
export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;
