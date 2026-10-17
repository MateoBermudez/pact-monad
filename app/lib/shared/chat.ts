import type { AmendmentTerms, AmendmentTypedData } from "@/lib/shared/amendment";
import type { AgreementRole } from "@/lib/shared/agreements";

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PROPOSAL_NOTE_LENGTH = 500;
export const DEFAULT_PROPOSAL_HOURS = 72;
export const MAX_PROPOSAL_HOURS = 168;
export const MESSAGES_PER_MINUTE = 30;

export type MessageKind = "text" | "proposal" | "system";

// "applied": el contrato ya la ejecutó. "accepted": la contraparte firmó y falta que el cliente envíe los fondos extra.
export type ProposalStatus = "pending" | "accepted" | "applied" | "rejected" | "withdrawn" | "superseded" | "expired";

// Lo necesario para enviar `amendAgreement`. `signature` es la de la parte que NO envía la transacción.
export type ProposalExecutionDto = {
  executor: AgreementRole;
  youExecute: boolean;
  terms: AmendmentTerms;
  signature: string;
  // Fondos que el cliente debe enviar junto con la transacción (0 si el importe no sube).
  valueWei: string;
  // Fondos que vuelven al cliente al aplicarse (0 si el importe no baja).
  refundWei: string;
};

export type ProposalDto = {
  id: string;
  agreementId: string;
  proposerId: string;
  proposerRole: AgreementRole;
  proposedByMe: boolean;
  oldAmountMon: string;
  newAmountMon: string;
  // Diferencia con signo: positiva si el cliente paga más, negativa si recibe una devolución.
  deltaMon: string;
  newDeadline: string | null;
  expiresAt: string;
  // Términos exactos que se firman y se ejecutan (no incluyen ninguna firma).
  terms: AmendmentTerms;
  status: ProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
  appliedTx: string | null;
  canAccept: boolean;
  canReject: boolean;
  canWithdraw: boolean;
  // Ya aceptada pero sin ejecutar: cualquiera de las partes puede anular las firmas pendientes con una transacción.
  canRevokeOnChain: boolean;
  // true cuando aceptar significa solo firmar (sin gas) y luego el cliente envía los fondos.
  acceptMeansSigning: boolean;
  execution: ProposalExecutionDto | null;
};

export type MessageDto = {
  id: string;
  agreementId: string;
  kind: MessageKind;
  senderId: string | null;
  senderRole: AgreementRole | null;
  mine: boolean;
  body: string;
  createdAt: string;
  proposal: ProposalDto | null;
};

export type ChatDto = {
  messages: MessageDto[];
  canPost: boolean;
  canPropose: boolean;
};

export type PreparedProposalDto = { typedData: AmendmentTypedData; expiresAt: string };
