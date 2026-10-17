import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), own: vi.fn() }));
vi.mock("@/lib/server/db", () => ({
  query: mocks.query,
  pool: () => ({}),
  withTransaction: vi.fn(),
}));
vi.mock("@/lib/server/services/listings", () => ({
  requireOwnListing: mocks.own,
  requireListing: vi.fn(),
  getListing: vi.fn(),
}));
vi.mock("@/lib/server/services/profiles", () => ({
  loadProviderSummaries: vi.fn(),
}));
vi.mock("@/lib/server/services/webhooks", () => ({ emitWebhook: vi.fn() }));
import { selectedAgreement } from "@/lib/server/services/applications";
import type { SessionUser } from "@/lib/shared/auth";
const user: SessionUser = {
  id: "client",
  wallet: "0x1111111111111111111111111111111111111111",
  username: "client",
  roles: ["client"],
  email: null,
  avatarUrl: null,
  displayName: null,
  isAgent: false,
  via: "session",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.own.mockResolvedValue({
    status: "awarded",
    title: "Identidad para café",
    description: "Entrega editable",
    rules_hash: `0x${"a".repeat(64)}`,
    deadline_days: 7,
    budget_mon: "20",
  });
});
describe("retomar el acuerdo seleccionado", () => {
  it("recupera monto y plazo de la propuesta seleccionada sin volver a adjudicar", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          wallet: "0x2222222222222222222222222222222222222222",
          price_mon: "15.000000",
          days: 4,
        },
      ]);
    const result = await selectedAgreement(user, "listing");
    expect(result).toMatchObject({
      amountMon: "15",
      deadlineDays: 4,
      description: "Identidad para café: Entrega editable",
    });
    expect(
      mocks.query.mock.calls.every(([sql]) => !String(sql).includes("update")),
    ).toBe(true);
  });
  it("rechaza otro bloqueo si el acuerdo ya fue indexado", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "agreement" }]);
    await expect(selectedAgreement(user, "listing")).rejects.toThrow(
      "ya tiene un acuerdo",
    );
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("no devuelve parámetros para una cuenta sin wallet", async () => {
    await expect(
      selectedAgreement({ ...user, wallet: null }, "listing"),
    ).rejects.toThrow("Vincula una wallet");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
