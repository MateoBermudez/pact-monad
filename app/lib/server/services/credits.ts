import "server-only";
import { randomUUID } from "node:crypto";
import { parseEther } from "ethers";
import { getProvider } from "@/lib/server/chain/provider";
import { query, withTransaction } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { ApiError, conflict, requireWallet } from "@/lib/server/http";
import type { SessionUser } from "@/lib/shared/auth";
import { CREDIT_COSTS, type CreditAction, type CreditsSummary } from "@/lib/shared/credits";

const currentMonth = () => new Date().toISOString().slice(0, 7);

export async function ensureMonthlyGrant(userId: string): Promise<void> {
  if (serverEnv.monthlyFreeCredits <= 0) return;
  await query(
    `insert into credit_ledger (user_id, delta, reason, ref) values ($1, $2, 'monthly_grant', $3)
     on conflict (user_id, reason, ref) do nothing`,
    [userId, serverEnv.monthlyFreeCredits, currentMonth()],
  );
}

export async function getBalance(userId: string): Promise<number> {
  const [row] = await query<{ balance: number }>("select balance from credit_balances where user_id = $1", [userId]);
  return row?.balance ?? 0;
}

export async function creditsSummary(userId: string): Promise<CreditsSummary> {
  await ensureMonthlyGrant(userId);
  return {
    balance: await getBalance(userId),
    monthlyFreeCredits: serverEnv.monthlyFreeCredits,
    costs: CREDIT_COSTS,
    priceMonPerCredit: serverEnv.creditPriceMon,
    treasuryAddress: serverEnv.treasuryAddress,
  };
}

// Descuenta los créditos antes de llamar a la IA y los devuelve si la llamada falla.
export async function withCredits<T>(userId: string, action: CreditAction, run: () => Promise<T>): Promise<T> {
  await ensureMonthlyGrant(userId);
  const cost = CREDIT_COSTS[action];
  const ref = `${action}:${randomUUID()}`;
  const meta = JSON.stringify({ action });

  await query("select spend_credits($1, $2, $3, $4::jsonb)", [userId, cost, ref, meta]);
  try {
    return await run();
  } catch (error) {
    await query(
      "insert into credit_ledger (user_id, delta, reason, ref, meta) values ($1, $2, 'refund', $3, $4::jsonb)",
      [userId, cost, ref, meta],
    );
    throw error;
  }
}

// Acredita una compra comprobando en la cadena que el pago llegó a la tesorería desde la wallet del usuario.
export async function purchaseCredits(user: SessionUser, txHash: string): Promise<{ credits: number; balance: number }> {
  const senderWallet = requireWallet(user);
  if (!serverEnv.treasuryAddress) {
    throw new ApiError(503, "treasury_not_configured", "La tesorería de PACT no está configurada");
  }

  const provider = getProvider();
  const [tx, receipt] = await Promise.all([provider.getTransaction(txHash), provider.getTransactionReceipt(txHash)]);
  if (!tx || !receipt) throw new ApiError(409, "tx_pending", "La transacción aún no está confirmada");
  if (receipt.status !== 1) throw new ApiError(422, "tx_failed", "La transacción falló en la cadena");
  if (tx.to?.toLowerCase() !== serverEnv.treasuryAddress) {
    throw new ApiError(422, "wrong_recipient", "El pago no fue a la tesorería de PACT");
  }
  if (tx.from.toLowerCase() !== senderWallet) {
    throw new ApiError(403, "wrong_sender", "El pago salió de una wallet distinta a la de tu sesión");
  }

  const credits = Number(tx.value / parseEther(serverEnv.creditPriceMon));
  if (credits < 1) {
    throw new ApiError(422, "amount_too_low", `El mínimo es ${serverEnv.creditPriceMon} MON por crédito`);
  }

  await withTransaction(async (client) => {
    const inserted = await client.query(
      `insert into credit_purchases (tx_hash, user_id, amount_wei, credits) values ($1, $2, $3, $4)
       on conflict (tx_hash) do nothing`,
      [txHash.toLowerCase(), user.id, tx.value.toString(), credits],
    );
    if (inserted.rowCount === 0) throw conflict("Esta transacción ya fue acreditada");
    await client.query(
      "insert into credit_ledger (user_id, delta, reason, ref, meta) values ($1, $2, 'purchase', $3, $4::jsonb)",
      [user.id, credits, txHash.toLowerCase(), JSON.stringify({ amountWei: tx.value.toString() })],
    );
  });

  return { credits, balance: await getBalance(user.id) };
}
