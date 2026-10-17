export enum PactStatus {
  None = 0,
  Created = 1,
  Accepted = 2,
  Delivered = 3,
  Approved = 4,
  Cancelled = 5,
}

export type AgreementStatusName = "Created" | "Accepted" | "Delivered" | "Approved" | "Cancelled";
