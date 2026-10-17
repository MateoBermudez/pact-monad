import { describe, expect, it, vi, afterEach } from "vitest";
import { providerError, reviewSchema, structureAgreement } from "./agreement-review";

const provider = "0x1234567890abcdef1234567890abcdef12345678";
const valid = {
  title: "Logo para cafetería",
  description: "Entrega del logo en PNG y SVG.",
  amount: "10",
  days: "3",
  provider,
};
afterEach(() => vi.unstubAllGlobals());

describe("revisión del acuerdo", () => {
  it("acepta datos completos y normaliza monto decimal", () => {
    expect(reviewSchema.parse({ ...valid, amount: "0,25" }).amount).toBe(0.25);
  });
  it.each(["", "0", "-1", "Infinity", "1e3", "0.0000001", "5000001"])(
    "rechaza monto inválido %s",
    (amount) => {
      expect(reviewSchema.safeParse({ ...valid, amount }).success).toBe(false);
    },
  );
  it.each(["", "0", "1.5", "366", "-1"])("rechaza plazo inválido %s", (days) => {
    expect(reviewSchema.safeParse({ ...valid, days }).success).toBe(false);
  });
  it("rechaza campos vacíos y direcciones inválidas o cero", () => {
    expect(reviewSchema.safeParse({ ...valid, title: "", description: "" }).success).toBe(false);
    for (const address of ["", "0x123", "0x" + "0".repeat(40), "0x" + "g".repeat(40)]) {
      expect(providerError(address)).toBeTruthy();
      expect(reviewSchema.safeParse({ ...valid, provider: address }).success).toBe(false);
    }
  });
  it("rechaza la wallet del cliente sin distinguir mayúsculas", () => {
    expect(providerError(provider, provider.toUpperCase())).toContain("distintas");
    expect(providerError(provider)).toBeNull();
  });
  it("usa el flujo actual de Next.js y conserva valores pendientes", async () => {
    const listing = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Logo",
      description: "Diseño de logo",
      budgetMon: null,
      deadlineDays: null,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ listing }))
      .mockResolvedValueOnce(Response.json({ listing, source: "ai" }));
    vi.stubGlobal("fetch", fetch);
    const result = await structureAgreement("Necesito un logo");
    expect(fetch.mock.calls[0]![0]).toContain("/api/listings");
    expect(fetch.mock.calls[1]![0]).toContain(`/api/listings/${listing.id}/structure`);
    expect(fetch.mock.calls[0]![1].credentials).toBe("include");
    expect(result.listing.budgetMon).toBeNull();
    expect(result.listing.deadlineDays).toBeNull();
  });
  it("explica que se necesita sesión sin inventar una propuesta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(structureAgreement("Necesito un logo")).rejects.toThrow("Inicia sesión");
  });
});
