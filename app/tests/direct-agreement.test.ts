import { beforeEach, describe, expect, it, vi } from "vitest";
import { directAgreementSchema } from "@/lib/shared/direct-agreement";
import { prepareDirectAgreement } from "@/lib/server/services/direct-agreements";
import type { SessionUser } from "@/lib/shared/auth";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  own: vi.fn(),
  create: vi.fn(),
  loadRules: vi.fn(),
  saveRules: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("@/lib/server/db", () => ({
  withTransaction: (run: (db: { query: typeof mocks.query }) => unknown) =>
    run({ query: mocks.query }),
}));
vi.mock("@/lib/server/http", () => ({
  conflict: (message: string) => new Error(message),
  forbidden: (message: string) => new Error(message),
  requireWallet: (user: { wallet: string | null }) => {
    if (!user.wallet) throw new Error("wallet_required");
    return user.wallet;
  },
}));
vi.mock("@/lib/server/services/listings", () => ({
  createListing: mocks.create,
  requireOwnListing: mocks.own,
}));
vi.mock("@/lib/server/services/rules", () => ({
  loadRules: mocks.loadRules,
  saveRulesVersion: mocks.saveRules,
  computeRulesHash: mocks.hash,
}));
const client = "0x1234567890abcdef1234567890abcdef12345678";
const provider = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const user: SessionUser = {
  id: "client",
  username: null,
  roles: ["client"],
  wallet: client,
  email: null,
  avatarUrl: null,
  displayName: null,
  isAgent: false,
  via: "session",
};
const input = {
  title: "Logo de cafetería",
  description: "Entregar el logo final en PNG y SVG.",
  amountMon: 10,
  days: 3,
  provider,
};
const hash = "0x" + "ab".repeat(32);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.create.mockResolvedValue({ id: "listing" });
  mocks.own.mockResolvedValue({
    status: "draft",
    description: input.description,
    budget_mon: "10",
    deadline_days: 3,
    rules_version: 1,
  });
  mocks.loadRules.mockResolvedValue([
    { position: 1, criterion: "PNG y SVG", weight: 5, source: "ai" },
  ]);
  mocks.saveRules.mockResolvedValue(2);
  mocks.hash.mockReturnValue(hash);
});
describe("confirmación de condiciones antes de firmar", () => {
  it("valida monto, plazo y proveedor en el servidor", () => {
    expect(directAgreementSchema.safeParse(input).success).toBe(true);
    for (const change of [
      { amountMon: 0 },
      { days: 1.5 },
      { provider: "0x" + "0".repeat(40) },
      { amountMon: 0.0000001 },
    ])
      expect(
        directAgreementSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
  it("rechaza al cliente como proveedor antes de escribir", async () => {
    await expect(
      prepareDirectAgreement(user, { ...input, provider: client }),
    ).rejects.toThrow("distintas");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("conserva las reglas de IA del mismo brief y devuelve su hash canónico", async () => {
    const result = await prepareDirectAgreement(user, input);
    expect(result.rulesHash).toBe(hash);
    expect(mocks.hash).toHaveBeenCalledWith("listing", 1, expect.any(Array));
    expect(mocks.saveRules).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("insert into direct_agreement_intents"),
      ["listing", "client", provider],
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'awarded'"),
      ["listing", hash],
    );
  });
  it("crea reglas humanas cuando el usuario cambia los entregables", async () => {
    mocks.own.mockResolvedValue({
      status: "draft",
      description: "Brief anterior",
      rules_version: 1,
    });
    await prepareDirectAgreement(user, input);
    expect(mocks.saveRules).toHaveBeenCalledWith(
      expect.any(Object),
      "listing",
      1,
      expect.any(Array),
      "human",
    );
    expect(mocks.hash).toHaveBeenCalledWith("listing", 2, expect.any(Array));
  });
  it("reutiliza un intento idéntico después de rechazar la firma", async () => {
    mocks.own.mockResolvedValue({
      status: "awarded",
      title: input.title,
      description: input.description,
      budget_mon: "10",
      deadline_days: 3,
      rules_hash: hash,
    });
    mocks.query.mockResolvedValue({ rows: [{ provider_wallet: provider }] });
    const result = await prepareDirectAgreement(user, {
      ...input,
      listingId: "listing",
    });
    expect(result.rulesHash).toBe(hash);
    expect(mocks.saveRules).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("impide modificar términos congelados", async () => {
    mocks.own.mockResolvedValue({
      status: "awarded",
      title: "Otra propuesta",
      description: input.description,
      budget_mon: "10",
      deadline_days: 3,
      rules_hash: hash,
    });
    mocks.query.mockResolvedValue({ rows: [{ provider_wallet: provider }] });
    await expect(prepareDirectAgreement(user, input)).rejects.toThrow(
      "confirmadas",
    );
    expect(mocks.saveRules).not.toHaveBeenCalled();
  });
});
