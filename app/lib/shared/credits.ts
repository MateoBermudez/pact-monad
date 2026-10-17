export const CREDIT_COSTS = {
  structure: 1,
  structureWithFile: 3,
  review: 2,
  screen: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export type CreditsSummary = {
  balance: number;
  monthlyFreeCredits: number;
  costs: typeof CREDIT_COSTS;
  priceMonPerCredit: string;
  treasuryAddress: string;
};
