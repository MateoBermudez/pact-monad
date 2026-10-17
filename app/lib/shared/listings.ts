import type { MatchBreakdown } from "@/lib/shared/matching";
import type { ProviderSummaryDto } from "@/lib/shared/profile";

export type ListingStatus = "draft" | "open" | "selecting" | "awarded" | "closed";
export type ApplicationStatus = "submitted" | "shortlisted" | "rejected" | "selected" | "withdrawn";
export type RuleSource = "ai" | "human";

export type RuleDto = { position: number; criterion: string; weight: number; source: RuleSource };

export type ListingDto = {
  id: string;
  clientId: string;
  clientUsername: string | null;
  clientName: string | null;
  clientScore: number;
  title: string;
  description: string | null;
  briefFileId: string | null;
  category: string | null;
  keywords: string[];
  budgetMon: string | null;
  deadlineDays: number | null;
  status: ListingStatus;
  rulesVersion: number;
  rulesHash: string | null;
  rulesConfirmedAt: string | null;
  createdAt: string;
  applicationsCount: number;
  rules: RuleDto[] | null;
  match: { score: number; reasons: string[] } | null;
  myApplication: { id: string; status: ApplicationStatus } | null;
};

export type ApplicationDto = {
  id: string;
  listingId: string;
  providerId: string;
  message: string;
  priceMon: string | null;
  days: number | null;
  status: ApplicationStatus;
  createdAt: string;
  provider: ProviderSummaryDto;
  match: { breakdown: MatchBreakdown; reasons: string[] } | null;
};

export type StructureSource = "ai" | "fallback";

export type StructureResultDto = { listing: ListingDto; source: StructureSource };

// Parámetros para que el cliente firme createAgreement desde su wallet tras elegir proveedor.
export type CreateAgreementParams = {
  provider: string;
  description: string;
  deadlineDays: number;
  rulesHash: string;
  amountMon: string;
};

export type SelectionResultDto = { listing: ListingDto; contractCall: CreateAgreementParams };
