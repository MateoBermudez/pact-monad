import type { AgreementStatusName } from "@/lib/shared/pact";
import type { RuleDto } from "@/lib/shared/listings";

export type AgreementRole = "client" | "provider";

export type CounterpartyDto = { id: string; wallet: string; displayName: string | null };

export type AgreementDto = {
  id: string;
  chainAgreementId: string;
  contractAddress: string;
  listingId: string | null;
  listingTitle: string | null;
  role: AgreementRole;
  counterparty: CounterpartyDto;
  amountMon: string;
  deadline: string;
  status: AgreementStatusName;
  description: string | null;
  evidenceUrl: string | null;
  providerNote: string | null;
  rulesHash: string | null;
  createTx: string | null;
  createdAt: string;
  updatedAt: string;
  latestVerdict: DecisionVerdict | null;
  iRated: boolean;
};

export type DecisionVerdict = "cumple" | "revisar";
export type DecisionKind = "recommendation" | "auto_release" | "human_release" | "human_override";

export type CriterionResultDto = {
  position: number;
  criterion: string;
  weight: number;
  met: boolean;
  reasoning: string;
  evidenceExcerpt: string | null;
};

// Registro inmutable de una evaluación de la IA: qué reglas se aplicaron, qué se encontró en cada una y por qué.
export type DecisionDto = {
  id: string;
  agreementId: string;
  kind: DecisionKind;
  decidedBy: "ai" | "human";
  verdict: DecisionVerdict;
  summary: string;
  criteria: CriterionResultDto[];
  rulesVersion: number | null;
  rulesHash: string | null;
  model: string;
  inputHash: string;
  amountMon: string;
  limitMon: string | null;
  decisionHash: string;
  createdAt: string;
  // true si ese hash quedó anclado en la cadena (evento AgentReleased): la decisión pagó de verdad.
  executed: boolean;
};

export type ReleaseCode =
  | "released"
  | "not_requested"
  | "verdict_revisar"
  | "above_limit"
  | "limit_not_set"
  | "agent_not_configured"
  | "already_settled"
  | "release_failed";

export type ReviewOutcomeDto = {
  decision: DecisionDto;
  released: boolean;
  txHash: string | null;
  code: ReleaseCode;
  message: string;
};

export type RatingDto = {
  id: string;
  agreementId: string;
  raterId: string;
  rateeId: string;
  rateeRole: AgreementRole;
  score: number;
  comment: string | null;
  createdAt: string;
};

export type AgreementDetailDto = AgreementDto & {
  rules: RuleDto[];
  decisions: DecisionDto[];
  ratings: RatingDto[];
  canRate: boolean;
};

export type ActivityDto = {
  event: string;
  label: string;
  txHash: string;
  blockNumber: number;
  agreementId: string | null;
  amountMon: string | null;
  at: string;
};

export type DashboardDto = {
  wallet: string;
  availableMon: string | null;
  lockedMon: string;
  incomingPendingMon: string;
  receivedMon: string;
  paidMon: string;
  refundedMon: string;
  asClient: Record<AgreementStatusName, number>;
  asProvider: Record<AgreementStatusName, number>;
  needsMyAction: number;
  openListings: number;
  pendingApplicationsToReview: number;
  credits: number;
  autoRelease: { enabled: boolean; limitMon: string };
  activity: ActivityDto[];
};
