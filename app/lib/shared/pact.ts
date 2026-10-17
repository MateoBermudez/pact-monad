export enum PactStatus {
  None = 0,
  Created = 1,
  Accepted = 2,
  Delivered = 3,
  Approved = 4,
  Cancelled = 5,
}

export type Agreement = {
  id: string;
  client: string;
  provider: string;
  amountWei: string;
  deadline: number;
  status: PactStatus;
  description: string;
  evidenceUrl: string;
};

export type StructureAgreementRequest = { text: string };
export type StructureAgreementResponse = { description: string; amount_mon: number; days: number };

export type ReviewEvidenceRequest = { requirements: string; provider_note: string; evidence_url: string };
export type ReviewEvidenceResponse = { verdict: "cumple" | "revisar"; reason: string };
