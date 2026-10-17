import { z } from "zod";
import { isAddress, ZeroAddress } from "ethers";
import { createListingSchema } from "./schemas";

export const directAgreementSchema = z
  .object({
    listingId: z.string().uuid().optional(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(5000),
    amountMon: z.number().positive().max(5_000_000),
    days: z.number().int().min(1).max(365),
    provider: z
      .string()
      .trim()
      .refine(
        (value) => isAddress(value) && value.toLowerCase() !== ZeroAddress,
      ),
  })
  .superRefine((value, context) => {
    const result = createListingSchema.safeParse({
      title: value.title,
      description: value.description,
      budgetMon: value.amountMon,
      deadlineDays: value.days,
    });
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
  });
export type DirectAgreementInput = z.infer<typeof directAgreementSchema>;
export type PreparedAgreement = {
  listingId: string;
  rulesHash: string;
  description: string;
  amountMon: string;
  days: number;
  provider: string;
};
