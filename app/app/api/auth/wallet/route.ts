import { parseAddress, startSession } from "@/lib/server/auth";
import { ApiError, authed, readJson } from "@/lib/server/http";
import { linkWallet } from "@/lib/server/services/identities";
import { linkWalletSchema } from "@/lib/shared/schemas";

export const POST = authed(async ({ request, user }) => {
  const body = await readJson(request, linkWalletSchema);
  const wallet = parseAddress(body.address);
  if (!wallet) throw new ApiError(400, "invalid_address", "Dirección de wallet inválida");

  const result = await linkWallet(user.id, wallet, body.signature);
  if (result.merged) await startSession(result.user.id);
  return result;
});
