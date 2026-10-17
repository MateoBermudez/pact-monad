import "client-only";
import { api, jsonRequest } from "@/lib/client/api";
import { sendEscrowAction } from "@/lib/client/escrow-wallet";
import { ensureSession } from "@/lib/client/auth";
import { connectWallet } from "@/lib/client/wallet";
import { amendmentTypedData, type AmendmentTerms } from "@/lib/shared/amendment";
import { CHAIN_ID } from "@/lib/shared/chain";
import type { ChatDto, MessageDto, PreparedProposalDto, ProposalDto, ProposalExecutionDto } from "@/lib/shared/chat";

export type ProposalInput = { newAmountMon?: number; newDeadline?: string; note?: string };

const base = (agreementId: string) => `/api/agreements/${agreementId}`;

export async function fetchChat(agreementId: string): Promise<ChatDto> {
  return (await api<{ chat: ChatDto }>(`${base(agreementId)}/messages`)).chat;
}

export async function sendChatMessage(agreementId: string, body: string): Promise<MessageDto> {
  return (await api<{ message: MessageDto }>(`${base(agreementId)}/messages`, jsonRequest("POST", { body }))).message;
}

// El servidor lee el nonce vigente del contrato; la wallet firma sin gas y el servidor verifica antes de guardar.
export async function proposeChange(agreementId: string, input: ProposalInput): Promise<MessageDto> {
  await ensureSession();
  const terms = {
    ...(input.newAmountMon === undefined ? {} : { newAmountMon: input.newAmountMon }),
    ...(input.newDeadline === undefined ? {} : { newDeadline: input.newDeadline }),
  };
  const { prepared } = await api<{ prepared: PreparedProposalDto }>(`${base(agreementId)}/proposals/prepare`, jsonRequest("POST", terms));
  const { signer } = await connectWallet();
  const { domain, types, message } = prepared.typedData;
  const signature = await signer.signTypedData(domain, types, message);
  const created = await api<{ message: MessageDto }>(
    `${base(agreementId)}/proposals`,
    jsonRequest("POST", {
      ...terms,
      ...(input.note ? { note: input.note } : {}),
      nonce: message.nonce,
      expiry: Number(message.expiry),
      signature,
    }),
  );
  return created.message;
}

export async function rejectProposal(agreementId: string, proposalId: string): Promise<void> {
  await api(`${base(agreementId)}/proposals/${proposalId}/reject`, { method: "POST" });
}

export async function withdrawProposal(agreementId: string, proposalId: string): Promise<void> {
  await api(`${base(agreementId)}/proposals/${proposalId}/withdraw`, { method: "POST" });
}

// Envía amendAgreement. Si el importe sube, el cliente manda la diferencia en la misma transacción; si baja, el
// contrato devuelve la diferencia al cliente. Devuelve el hash de la transacción confirmada.
export async function executeAmendment(execution: ProposalExecutionDto, contractAddress: string): Promise<string> {
  const { id, newAmount, newDeadline, expiry } = execution.terms;
  return sendEscrowAction(
    "amendAgreement",
    [id, newAmount, newDeadline, expiry, execution.signature, { value: BigInt(execution.valueWei) }],
    contractAddress,
  );
}

// Aceptar una propuesta. Devuelve el hash si la aceptación terminó enviando la transacción en el mismo paso.
export async function acceptProposal(
  agreement: { id: string; contractAddress: string },
  proposal: ProposalDto,
): Promise<string | null> {
  await ensureSession();
  if (proposal.acceptMeansSigning) {
    // El cliente subió el precio: el proveedor solo firma (sin gas) y luego el cliente envía los fondos.
    const { signer } = await connectWallet();
    const typed = amendmentTypedData({ chainId: CHAIN_ID, contract: agreement.contractAddress, terms: proposal.terms });
    const signature = await signer.signTypedData(typed.domain, typed.types, typed.message);
    await api(`${base(agreement.id)}/proposals/${proposal.id}/accept`, jsonRequest("POST", { signature }));
    return null;
  }
  await api(`${base(agreement.id)}/proposals/${proposal.id}/accept`, jsonRequest("POST", {}));
  const accepted = (await fetchChat(agreement.id)).messages.find((message) => message.proposal?.id === proposal.id)?.proposal;
  if (!accepted?.execution?.youExecute) return null;
  return executeAmendment(accepted.execution, agreement.contractAddress);
}

export function revokeSignatures(chainAgreementId: string, contractAddress: string): Promise<string> {
  return sendEscrowAction("invalidateAmendments", [chainAgreementId], contractAddress);
}

export type { AmendmentTerms };
