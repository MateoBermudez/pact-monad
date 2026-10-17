import "server-only";
import { pactInterface } from "@/lib/server/chain/contract";

export type ChainEvent =
  | {
      name: "AgreementCreated";
      id: bigint;
      client: string;
      provider: string;
      amount: bigint;
      deadline: bigint;
      rulesHash: string;
      description: string;
    }
  | { name: "AgreementAccepted"; id: bigint; provider: string }
  | { name: "DeliveryRegistered"; id: bigint; provider: string; evidenceUrl: string; note: string }
  | { name: "AgreementApproved"; id: bigint; provider: string; amount: bigint }
  | { name: "AgreementCancelled"; id: bigint; client: string; amount: bigint }
  | { name: "AutoReleaseLimitSet"; client: string; limit: bigint }
  | { name: "AgentReleased"; id: bigint; decisionHash: string; amount: bigint };

function big(value: unknown, field: string): bigint {
  if (typeof value !== "bigint") throw new Error(`Campo ${field} inválido en el evento`);
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Campo ${field} inválido en el evento`);
  return value;
}

const address = (value: unknown, field: string) => text(value, field).toLowerCase();

export function decodeLog(log: { topics: readonly string[]; data: string }): ChainEvent | null {
  const parsed = pactInterface.parseLog({ topics: [...log.topics], data: log.data });
  if (!parsed) return null;
  const args = parsed.args;

  switch (parsed.name) {
    case "AgreementCreated":
      return {
        name: parsed.name,
        id: big(args.id, "id"),
        client: address(args.client, "client"),
        provider: address(args.provider, "provider"),
        amount: big(args.amount, "amount"),
        deadline: big(args.deadline, "deadline"),
        rulesHash: text(args.rulesHash, "rulesHash").toLowerCase(),
        description: text(args.description, "description"),
      };
    case "AgreementAccepted":
      return { name: parsed.name, id: big(args.id, "id"), provider: address(args.provider, "provider") };
    case "DeliveryRegistered":
      return {
        name: parsed.name,
        id: big(args.id, "id"),
        provider: address(args.provider, "provider"),
        evidenceUrl: text(args.evidenceUrl, "evidenceUrl"),
        note: text(args.note, "note"),
      };
    case "AgreementApproved":
      return {
        name: parsed.name,
        id: big(args.id, "id"),
        provider: address(args.provider, "provider"),
        amount: big(args.amount, "amount"),
      };
    case "AgreementCancelled":
      return {
        name: parsed.name,
        id: big(args.id, "id"),
        client: address(args.client, "client"),
        amount: big(args.amount, "amount"),
      };
    case "AutoReleaseLimitSet":
      return { name: parsed.name, client: address(args.client, "client"), limit: big(args.limit, "limit") };
    case "AgentReleased":
      return {
        name: parsed.name,
        id: big(args.id, "id"),
        decisionHash: text(args.decisionHash, "decisionHash").toLowerCase(),
        amount: big(args.amount, "amount"),
      };
    default:
      return null;
  }
}

export function serializeEvent(event: ChainEvent): Record<string, string> {
  return Object.fromEntries(
    Object.entries(event)
      .filter(([key]) => key !== "name")
      .map(([key, value]) => [key, String(value)]),
  );
}
