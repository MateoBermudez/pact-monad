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

export function nextActionFor(
  type: WebhookEventType,
  recipient: Party | null,
  data?: Partial<WebhookData["decision.created"]>,
): NextAction {
  const acts = (actor: Party) => recipient === actor;
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
      if (data?.executed) return none("La IA ya liberó el pago");
      if (data?.kind === "auto_release") return none("La IA está liberando el pago dentro del límite que fijaste");
      return data?.verdict === "cumple"
        ? { actor: "client", action: "approve_payment", youAct: acts("client"), hint: "La IA recomienda pagar: aprueba on-chain con approveAndRelease, o fija un límite para que pague sola" }
        : { actor: "client", action: "review_delivery", youAct: acts("client"), hint: "La IA recomienda revisar la entrega antes de pagar" };
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
