import { z } from "zod";
import { OAUTH_PROVIDERS, ROLES } from "@/lib/shared/auth";
import { DEFAULT_PROPOSAL_HOURS, MAX_MESSAGE_LENGTH, MAX_PROPOSAL_HOURS, MAX_PROPOSAL_NOTE_LENGTH } from "@/lib/shared/chat";
import { FILE_PURPOSES } from "@/lib/shared/files";
import { AVAILABILITIES, MAX_LINKS, MAX_SKILLS } from "@/lib/shared/profile";
import { normalizeUsername, usernameError } from "@/lib/shared/username";
import { WEBHOOK_EVENTS } from "@/lib/shared/webhooks";

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

export const usernameQuerySchema = z.object({ u: z.string().max(40).default("") });

export const linkWalletSchema = z.object({
  address: z.string().min(1).max(64),
  signature: z.string().min(1).max(200),
});

export const purchaseCreditsSchema = z.object({ txHash: txHashSchema });

export const filePurposeSchema = z.enum(FILE_PURPOSES);

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(512)
  .refine((value) => /^https?:\/\//i.test(value), "El enlace debe empezar con http:// o https://");

const httpsUrlSchema = httpUrlSchema.refine((value) => /^https:\/\//i.test(value), "El enlace debe empezar con https://");

const profileLinkSchema = z.object({ label: z.string().trim().min(1).max(30), url: httpUrlSchema });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const requestUploadSchema = z.object({
  purpose: filePurposeSchema,
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().min(1).max(100 * 1024 * 1024),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

export const rolesSchema = z
  .array(z.enum(ROLES))
  .min(1, "Elige al menos un rol")
  .transform((roles) => ROLES.filter((role) => roles.includes(role)));

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).max(200).optional(),
});

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const updateProfileSchema = z.object({
  roles: rolesSchema.optional(),
  avatarUrl: z.union([httpsUrlSchema, z.string().regex(/^\/api\/avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)]).nullable().optional(),
  location: optionalText(80),
  availability: z.enum(AVAILABILITIES).optional(),
  links: z.array(profileLinkSchema).max(MAX_LINKS, `Puedes agregar hasta ${MAX_LINKS} enlaces`).optional(),
  displayName: z.string().trim().min(1).max(60).nullable().optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  keywords: z.array(z.string().max(60)).max(40).optional(),
  skills: z
    .array(z.object({ slug: z.string().min(1).max(40), level: z.number().int().min(1).max(5).default(3) }))
    .max(MAX_SKILLS, `Puedes elegir hasta ${MAX_SKILLS} habilidades`)
    .optional(),
  isAgent: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const createPortfolioItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  url: httpUrlSchema.optional(),
  fileId: uuidSchema.optional(),
  tags: z.array(z.string().max(60)).max(20).default([]),
});
export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

export const monAmountSchema = z
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

export const reviewAgreementSchema = z.object({ release: z.boolean().default(false) });
export type ReviewAgreementInput = z.infer<typeof reviewAgreementSchema>;

export const rateAgreementSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export type RateAgreementInput = z.infer<typeof rateAgreementSchema>;

export const createWebhookSchema = z.object({
  url: z.string().trim().min(8).max(512),
  events: z.array(z.enum(WEBHOOK_EVENTS)).max(WEBHOOK_EVENTS.length).default([]),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().trim().min(8).max(512).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).max(WEBHOOK_EVENTS.length).optional(),
  active: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export const sendMessageSchema = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH) });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

const proposalTermsSchema = z
  .object({
    newAmountMon: monAmountSchema.optional(),
    // Nuevo plazo (ISO 8601). Si se omite, el plazo del acuerdo no cambia.
    newDeadline: z.string().datetime().optional(),
    expiresInHours: z.number().int().min(1).max(MAX_PROPOSAL_HOURS).default(DEFAULT_PROPOSAL_HOURS),
  })
  .refine((value) => value.newAmountMon !== undefined || value.newDeadline !== undefined, {
    message: "Propón un nuevo precio, un nuevo plazo o ambos",
  });

export const prepareProposalSchema = proposalTermsSchema;
export type PrepareProposalInput = z.infer<typeof prepareProposalSchema>;

const signatureSchema = z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Firma inválida");

export const createProposalSchema = proposalTermsSchema.and(
  z.object({
    nonce: z.string().regex(/^\d{1,20}$/),
    expiry: z.number().int().positive(),
    signature: signatureSchema,
    note: z.string().trim().max(MAX_PROPOSAL_NOTE_LENGTH).optional(),
  }),
);
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const acceptProposalSchema = z.object({ signature: signatureSchema.optional() });
export type AcceptProposalInput = z.infer<typeof acceptProposalSchema>;
