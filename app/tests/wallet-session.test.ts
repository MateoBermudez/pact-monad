import { afterEach, describe, expect, it, vi } from "vitest";
import { connectWallet } from "@/lib/client/wallet";
import { ensureSession, linkWalletToAccount } from "@/lib/client/auth";
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("sesión antes de MetaMask", () => {
  it("no consulta ni abre MetaMask si no hay sesión", async () => {
    const request = vi.fn();
    vi.stubGlobal("window", { ethereum: { request } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await expect(connectWallet()).rejects.toThrow();
    await expect(linkWalletToAccount()).rejects.toThrow("Inicia sesión");
    await expect(ensureSession()).rejects.toThrow("Inicia sesión");
    expect(request).not.toHaveBeenCalled();
  });
  it("no abre MetaMask para transacciones si la cuenta aún no vinculó una wallet", async () => {
    const request = vi.fn();
    vi.stubGlobal("window", { ethereum: { request } });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ user: { id: "social", wallet: null } }),
          ),
      ),
    );
    await expect(connectWallet()).rejects.toThrow("Vincula tu wallet");
    expect(request).not.toHaveBeenCalled();
  });
});
