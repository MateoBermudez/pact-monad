import { describe, expect, it } from "vitest";
import { sendEscrowAction } from "@/lib/client/escrow-wallet";
import { CONTRACT_ADDRESS } from "@/lib/shared/chain";

describe("acciones de un acuerdo indexado", () => {
  it("rechaza acuerdos de otro contrato antes de pedir una firma", async () => {
    const other =
      CONTRACT_ADDRESS.toLowerCase() ===
      "0x1111111111111111111111111111111111111111"
        ? "0x2222222222222222222222222222222222222222"
        : "0x1111111111111111111111111111111111111111";
    await expect(
      sendEscrowAction("approveAndRelease", ["1"], other),
    ).rejects.toThrow("otro contrato");
  });
});
