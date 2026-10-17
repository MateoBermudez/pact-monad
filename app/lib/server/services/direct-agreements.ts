import "server-only";
import { withTransaction } from "@/lib/server/db";
import { conflict, forbidden } from "@/lib/server/http";
import { createListing, requireOwnListing } from "./listings";
import { computeRulesHash, loadRules, saveRulesVersion } from "./rules";
import type { SessionUser } from "@/lib/shared/auth";
import type {
  DirectAgreementInput,
  PreparedAgreement,
} from "@/lib/shared/direct-agreement";

/** Store and freeze the reviewed terms before the client signs createAgreement. */
export async function prepareDirectAgreement(
  user: SessionUser,
  input: DirectAgreementInput,
): Promise<PreparedAgreement> {
  const provider = input.provider.toLowerCase();
  if (provider === user.wallet.toLowerCase())
    throw forbidden("Cliente y proveedor deben tener wallets distintas.");
  const listingId =
    input.listingId ??
    (
      await createListing(user, {
        title: input.title,
        description: input.description,
        budgetMon: input.amountMon,
        deadlineDays: input.days,
      })
    ).id;
  return withTransaction(async (db) => {
    await db.query("select 1 from listings where id = $1 for update", [
      listingId,
    ]);
    const listing = await requireOwnListing(db, user.id, listingId);
    if (listing.status !== "draft") {
      const { rows } = await db.query<{ provider_wallet: string }>(
        "select provider_wallet from direct_agreement_intents where listing_id = $1 and client_id = $2",
        [listingId, user.id],
      );
      if (
        listing.status !== "awarded" ||
        rows[0]?.provider_wallet !== provider ||
        listing.title !== input.title ||
        listing.description !== input.description ||
        Number(listing.budget_mon) !== input.amountMon ||
        listing.deadline_days !== input.days ||
        !listing.rules_hash
      )
        throw conflict(
          "Las condiciones ya fueron confirmadas. Crea un nuevo borrador para cambiarlas.",
        );
      return {
        listingId,
        rulesHash: listing.rules_hash,
        description: input.description,
        amountMon: String(input.amountMon),
        days: input.days,
        provider,
      };
    }
    await db.query(
      "update listings set title = $2, description = $3, budget_mon = $4, deadline_days = $5 where id = $1",
      [listingId, input.title, input.description, input.amountMon, input.days],
    );
    // Reuse AI criteria only if their brief is unchanged; edited/manual terms become human criteria.
    let rules =
      listing.description === input.description &&
      Number(listing.budget_mon) === input.amountMon &&
      listing.deadline_days === input.days
        ? await loadRules(db, listingId, listing.rules_version)
        : [];
    let version = listing.rules_version;
    if (!rules.length) {
      version = await saveRulesVersion(
        db,
        listingId,
        version,
        [
          {
            criterion:
              "La entrega cumple íntegramente la descripción, los entregables y los formatos confirmados en el acuerdo",
            weight: 5,
          },
        ],
        "human",
      );
      rules = await loadRules(db, listingId, version);
    }
    const rulesHash = computeRulesHash(listingId, version, rules);
    await db.query(
      "insert into direct_agreement_intents (listing_id, client_id, provider_wallet) values ($1, $2, $3)",
      [listingId, user.id, provider],
    );
    await db.query(
      "update listings set status = 'awarded', rules_hash = $2, rules_confirmed_at = now() where id = $1",
      [listingId, rulesHash],
    );
    return {
      listingId,
      rulesHash,
      description: input.description,
      amountMon: String(input.amountMon),
      days: input.days,
      provider,
    };
  });
}
