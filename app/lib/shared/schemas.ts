import { z } from "zod";
import { OAUTH_PROVIDERS } from "@/lib/shared/auth";
import { FILE_PURPOSES } from "@/lib/shared/files";
import { normalizeUsername, usernameError } from "@/lib/shared/username";

export const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Hash de transacción inválido");

export const uuidSchema = z.string().uuid();

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);

export const usernameSchema = z
  .string()
  .max(40)
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const message = usernameError(value);
    if (message) ctx.addIssue({ code: "custom", message });
  });

export const setUsernameSchema = z.object({ username: usernameSchema });

export const usernameQuerySchema = z.object({ u: usernameSchema });

export const linkWalletSchema = z.object({
  address: z.string().min(1).max(64),
  signature: z.string().min(1).max(200),
});

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

const monAmountSchema = z
  .number()
  .positive()
  .max(5_000_000)
  .refine((value) => Math.abs(value * 1e6 - Math.round(value * 1e6)) < 1e-6, "Máximo 6 decimales");

const listingFieldsSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  briefFileId: uuidSchema.optional(),
  budgetMon: monAmountSchema.optional(),
  deadlineDays: z.number().int().min(1).max(365).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  keywords: z.array(z.string().max(60)).max(40).optional(),
});

export const createListingSchema = listingFieldsSchema.refine((value) => value.description || value.briefFileId, {
  message: "Describe lo que necesitas o adjunta un archivo",
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = listingFieldsSchema.omit({ briefFileId: true }).partial();
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

export const saveRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        criterion: z.string().trim().min(5).max(300),
        weight: z.number().int().min(1).max(5).default(3),
      }),
    )
    .min(1)
    .max(12),
});
export type SaveRulesInput = z.infer<typeof saveRulesSchema>;

export const applySchema = z.object({
  message: z.string().trim().min(10).max(2000),
  priceMon: monAmountSchema.optional(),
  days: z.number().int().min(1).max(365).optional(),
});
export type ApplyInput = z.infer<typeof applySchema>;

export const applicationActionSchema = z.object({ action: z.enum(["shortlist", "reject", "select", "withdraw"]) });
export type ApplicationAction = z.infer<typeof applicationActionSchema>["action"];

export const listListingsQuerySchema = z.object({
  scope: z.enum(["recommended", "open", "mine"]).default("recommended"),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const providersQuerySchema = z.object({
  skills: z.string().max(200).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createAgentKeySchema = z.object({
  name: z.string().trim().min(1).max(60),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateAgentKeyInput = z.infer<typeof createAgentKeySchema>;
