import type { DecisionKind, DecisionVerdict } from "@/lib/shared/agreements";
import type { AgreementStatusName } from "@/lib/shared/pact";

export const WEBHOOK_EVENTS = [
  "ping",
  "listing.matched",
  "application.received",
  "application.selected",
  "application.rejected",
  "agreement.created",
  "agreement.accepted",
  "agreement.delivered",
  "agreement.approved",
  "agreement.cancelled",
  "agreement.message",
  "agreement.amended",
  "proposal.created",
  "proposal.accepted",
  "proposal.rejected",
  "decision.created",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export type Party = "client" | "provider";

export type NextActionName =
  | "review_applications"
  | "apply_to_listing"
  | "create_agreement"
  | "accept_agreement"
  | "register_delivery"
  | "review_delivery"
  | "approve_payment"
  | "rate"
  | "respond_to_proposal"
  | "execute_amendment"
  | "none";

// Qué sigue y quién lo hace. `youAct` dice si le toca a quien recibe el aviso: un agente solo reacciona cuando es true.
export type NextAction = { actor: Party | "both" | "none"; action: NextActionName; youAct: boolean; hint: string };

type AgreementRef = {
  agreementId: string;
  chainAgreementId: string;
  contractAddress: string;
  listingId: string | null;
  amountMon: string;
  status: AgreementStatusName;
};

export type WebhookData = {
  ping: { message: string };
  "listing.matched": {
    listingId: string;
    title: string;
    category: string | null;
    budgetMon: string | null;
    score: number;
    reasons: string[];
  };
  "application.received": { listingId: string; applicationId: string; providerId: string; priceMon: string | null };
  "application.selected": { listingId: string; applicationId: string };
  "application.rejected": { listingId: string; applicationId: string };
  "agreement.created": AgreementRef;
  "agreement.accepted": AgreementRef;
  "agreement.delivered": AgreementRef & { evidenceUrl: string; providerNote: string };
  "agreement.approved": AgreementRef;
  "agreement.cancelled": AgreementRef;
  "decision.created": { agreementId: string; decisionId: string; verdict: DecisionVerdict; kind: DecisionKind; executed: boolean };
  "agreement.message": { agreementId: string; messageId: string; senderRole: Party; preview: string };
  "agreement.amended": AgreementRef & { oldAmountMon: string; refundedMon: string; deadline: string };
  "proposal.created": {
    agreementId: string;
    proposalId: string;
    proposerRole: Party;
    oldAmountMon: string;
    newAmountMon: string;
    newDeadline: string | null;
    expiresAt: string;
  };
  "proposal.accepted": { agreementId: string; proposalId: string; newAmountMon: string; deltaMon: string; executor: Party };
  "proposal.rejected": { agreementId: string; proposalId: string };
};

// Lo que recibe la URL del webhook en el cuerpo de la petición.
export type WebhookEnvelope<T extends WebhookEventType = WebhookEventType> = {
  id: string;
  type: T;
  createdAt: string;
  recipientRole: Party | null;
  data: WebhookData[T];
  nextAction: NextAction;
};

const none = (hint: string): NextAction => ({ actor: "none", action: "none", youAct: false, hint });

export function nextActionFor(type: WebhookEventType, recipient: Party | null, data: Record<string, unknown> = {}): NextAction {
  const acts = (actor: Party) => recipient === actor;
  const verdict = data.verdict;
  const executed = data.executed === true;
  switch (type) {
    case "listing.matched":
      return { actor: "provider", action: "apply_to_listing", youAct: acts("provider"), hint: "Si te interesa, postúlate con POST /api/listings/{listingId}/applications {message, priceMon, days}" };
    case "application.received":
      return { actor: "client", action: "review_applications", youAct: acts("client"), hint: "Revisa los postulantes y elige uno con PATCH /api/applications/{id} {action:'select'}" };
    case "application.selected":
      return { actor: "client", action: "create_agreement", youAct: false, hint: "Te eligieron. Espera a que el cliente bloquee los fondos; recibirás agreement.created" };
    case "agreement.created":
      return { actor: "provider", action: "accept_agreement", youAct: acts("provider"), hint: "El proveedor acepta on-chain con acceptAgreement(chainAgreementId)" };
    case "agreement.accepted":
      return { actor: "provider", action: "register_delivery", youAct: acts("provider"), hint: "El proveedor entrega on-chain con registerDelivery(chainAgreementId, url, nota)" };
    case "agreement.delivered":
      return { actor: "client", action: "review_delivery", youAct: acts("client"), hint: "Revisa con POST /api/agreements/{id}/review, o aprueba on-chain con approveAndRelease" };
    case "agreement.approved":
      return { actor: "both", action: "rate", youAct: recipient !== null, hint: "Califica a tu contraparte con POST /api/agreements/{id}/rating" };
    case "decision.created":
      if (executed) return none("La IA ya liberó el pago");
      if (data.kind === "auto_release") return none("La IA está liberando el pago dentro del límite que fijaste");
      return verdict === "cumple"
        ? { actor: "client", action: "approve_payment", youAct: acts("client"), hint: "La IA recomienda pagar: aprueba on-chain con approveAndRelease, o fija un límite para que pague sola" }
        : { actor: "client", action: "review_delivery", youAct: acts("client"), hint: "La IA recomienda revisar la entrega antes de pagar" };
    case "agreement.message":
      return none("Nuevo mensaje. Responde con POST /api/agreements/{agreementId}/messages {body}");
    case "proposal.created": {
      const other: Party = data.proposerRole === "client" ? "provider" : "client";
      return {
        actor: other,
        action: "respond_to_proposal",
        youAct: acts(other),
        hint: "Acepta, rechaza o contraproponer: GET /api/agreements/{agreementId}/messages trae la propuesta con los pasos de ejecución",
      };
    }
    case "proposal.accepted": {
      const executor: Party = data.executor === "provider" ? "provider" : "client";
      return {
        actor: executor,
        action: "execute_amendment",
        youAct: acts(executor),
        hint: "Aceptaron tu propuesta: quien ejecuta envía amendAgreement on-chain (el cliente añade los fondos si el importe sube)",
      };
    }
    case "proposal.rejected":
      return none("La propuesta fue rechazada. Puedes enviar otra desde el chat");
    case "agreement.amended":
      return none("Importe o plazo actualizados en el contrato");
    default:
      return none("No hay acción pendiente");
  }
}

export type WebhookEndpointDto = {
  id: string;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
};

export type WebhookDeliveryDto = {
  id: string;
  event: WebhookEventType;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  nextAttemptAt: string;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
};
