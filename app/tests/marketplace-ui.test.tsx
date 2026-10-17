import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Credits from "@/components/pages/Credits";
import { MyApplications } from "@/components/pages/Listings";
import ListingDetail from "@/components/pages/ListingDetail";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  connect: vi.fn(),
  send: vi.fn(),
  fund: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/creditos",
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/client/pact-context", () => ({
  usePact: () => ({ connected: true, connectWallet: mocks.connect }),
}));
vi.mock("@/lib/client/wallet", () => ({
  connectWallet: async () => ({ signer: { sendTransaction: mocks.send } }),
}));
vi.mock("@/lib/client/marketplace-wallet", () => ({
  fundSelectedAgreement: mocks.fund,
  fundingTransactionState: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sessionStorage.clear();
});
describe("acciones de marketplace", () => {
  it("separa confirmar proveedor de firmar y bloquear fondos", async () => {
    let awarded = false;
    const call = {
      provider: "0x2222222222222222222222222222222222222222",
      description: "Logo: entrega editable",
      amountMon: "10",
      deadlineDays: 3,
      rulesHash: `0x${"a".repeat(64)}`,
    };
    const listing = () => ({
      id: "l1",
      clientId: "client",
      clientName: "Cliente",
      title: "Logo",
      description: "Entrega editable",
      status: awarded ? "awarded" : "open",
      budgetMon: "10",
      deadlineDays: 3,
      keywords: [],
      rules: [
        { position: 1, criterion: "Entregar archivos editables", weight: 3 },
      ],
    });
    const application = () => ({
      id: "a1",
      providerId: "provider",
      provider: {
        username: "andrea",
        displayName: "Andrea",
        wallet: call.provider,
      },
      status: awarded ? "selected" : "submitted",
      message: "Puedo crear tu identidad",
      priceMon: "10",
      days: 3,
    });
    const fetcher = vi.fn((path: string) => {
      if (path === "/api/auth/me")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: "client",
                wallet: "0x1111111111111111111111111111111111111111",
              },
            }),
          ),
        );
      if (path === "/api/applications/a1") {
        awarded = true;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              selection: { listing: listing(), contractCall: call },
            }),
          ),
        );
      }
      if (path.endsWith("/applications"))
        return Promise.resolve(
          new Response(JSON.stringify({ applications: [application()] })),
        );
      if (path.endsWith("/selection"))
        return Promise.resolve(
          new Response(JSON.stringify({ contractCall: call })),
        );
      return Promise.resolve(
        new Response(JSON.stringify({ listing: listing() })),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<ListingDetail id="l1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Elegir proveedor" }),
    );
    expect(
      fetcher.mock.calls.some(([path]) => path === "/api/applications/a1"),
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar proveedor" }),
    );
    await screen.findByRole("heading", {
      name: "Confirma y bloquea los fondos.",
    });
    expect(mocks.fund).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Crear acuerdo y bloquear 10 MON" }),
    ).toBeDisabled();
  });
  it("verifica un pago existente sin enviar otra transacción", async () => {
    const fetcher = vi.fn((path: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            path === "/api/credits"
              ? {
                  credits: {
                    balance: 20,
                    monthlyFreeCredits: 20,
                    priceMonPerCredit: "0.1",
                    treasuryAddress:
                      "0x1111111111111111111111111111111111111111",
                    costs: { structure: 1, structureWithFile: 3, review: 2 },
                  },
                }
              : { credits: 10, balance: 30 },
          ),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Credits />);
    await screen.findByText("20");
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Hash de la transacción"), {
      target: { value: `0x${"a".repeat(64)}` },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar y acreditar" }),
    );
    await screen.findByText(
      "Compra verificada. Los créditos ya están disponibles.",
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/credits/purchase",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("retira una propuesta mediante la API y recarga su estado", async () => {
    let withdrawn = false;
    const fetcher = vi.fn((path: string) => {
      if (path === "/api/applications/a1") withdrawn = true;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            applications: [
              {
                id: "a1",
                listingId: "l1",
                listingTitle: "Logo",
                message: "Una propuesta completa",
                priceMon: "10",
                days: 3,
                status: withdrawn ? "withdrawn" : "submitted",
              },
            ],
          }),
        ),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<MyApplications />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retirar propuesta" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Retirada")).toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/applications/a1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "withdraw" }),
      }),
    );
  });
});
