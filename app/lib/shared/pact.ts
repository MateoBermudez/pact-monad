export enum PactStatus {
  None = 0,
  Created = 1,
  Accepted = 2,
  Delivered = 3,
  Approved = 4,
  Cancelled = 5,
}

export type AgreementStatusName = "Created" | "Accepted" | "Delivered" | "Approved" | "Cancelled";

export type AgreementPartyDto = {
  id: string;
  username: string | null;
  displayName: string | null;
  wallet: string | null;
};

export type AgreementDto = {
  id: string;
  chainAgreementId: string;
  contractAddress: string;
  listingId: string | null;
  createdById: string;
  createdByUsername: string | null;
  client: AgreementPartyDto;
  provider: AgreementPartyDto;
  amountWei: string;
  deadline: string;
  status: AgreementStatusName;
  rulesHash: string | null;
  description: string | null;
  evidenceUrl: string | null;
  providerNote: string | null;
  createTx: string | null;
  createdAt: string;
};
