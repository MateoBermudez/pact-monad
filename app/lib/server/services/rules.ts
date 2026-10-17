import "server-only";
import { keccak256, toUtf8Bytes } from "ethers";
import type { PoolClient } from "pg";
import type { Queryable } from "@/lib/server/db";
import type { RuleDto, RuleSource } from "@/lib/shared/listings";

export type RuleInput = { criterion: string; weight: number };

type RuleRow = { position: number; criterion: string; weight: number; source: RuleSource };

const comparable = (criterion: string) => criterion.trim().toLowerCase().replace(/\s+/g, " ");

export async function loadRules(db: Queryable, listingId: string, version: number): Promise<RuleDto[]> {
  if (version < 1) return [];
  const { rows } = await db.query<RuleRow>(
    "select position, criterion, weight, source from listing_rules where listing_id = $1 and version = $2 order by position",
    [listingId, version],
  );
  return rows;
}

// Hash canónico de las reglas confirmadas: es lo que se fija on-chain al crear el acuerdo.
export function computeRulesHash(listingId: string, version: number, rules: RuleInput[]): string {
  const canonical = JSON.stringify({
    v: 1,
    listingId,
    version,
    rules: rules.map((rule) => ({ criterion: rule.criterion, weight: rule.weight })),
  });
  return keccak256(toUtf8Bytes(canonical));
}

// Cada guardado crea una versión nueva; las reglas que el humano no tocó conservan su origen ("ai").
export async function saveRulesVersion(
  client: PoolClient,
  listingId: string,
  currentVersion: number,
  rules: RuleInput[],
  origin: RuleSource,
): Promise<number> {
  const previous = await loadRules(client, listingId, currentVersion);
  const next = currentVersion + 1;

  for (const [index, rule] of rules.entries()) {
    const unchanged = previous.find(
      (old) => comparable(old.criterion) === comparable(rule.criterion) && old.weight === rule.weight,
    );
    const source: RuleSource = origin === "ai" ? "ai" : (unchanged?.source ?? "human");
    await client.query(
      "insert into listing_rules (listing_id, version, position, criterion, weight, source) values ($1, $2, $3, $4, $5, $6)",
      [listingId, next, index + 1, rule.criterion.trim(), rule.weight, source],
    );
  }
  await client.query("update listings set rules_version = $2 where id = $1", [listingId, next]);
  return next;
}
