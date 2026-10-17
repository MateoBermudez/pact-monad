import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PactDetail from "@/components/pages/PactDetail";
import type { AgreementDetailDto } from "@/lib/shared/agreements";

const state = vi.hoisted(() => ({ send: vi.fn(), api: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/client/api", () => ({
  api: state.api,
  jsonRequest: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));
vi.mock("@/lib/client/escrow-wallet", () => ({ sendEscrowAction: state.send }));
vi.mock("@/lib/client/pact-context", () => ({ usePact: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/client/realtime", () => ({ subscribeToChanges: () => () => undefined }));
vi.mock("@/components/AgreementChat", () => ({ AgreementChat: () => null }));
vi.mock("@/components/FileUpload", () => ({
  FileUpload: () => null,
  FileLink: () => null,
}));

const agreement = {
  id: "a1",
  chainAgreementId: "4",
  contractAddress: "0x09AE7717bdcDC03eA73D539ECc321Dc96B8a80D3",
  listingId: null,
  listingTitle: "Logo",
  createdById: "u1",
  createdByUsername: null,
  role: "provider",
  counterparty: { wallet: "0x1111111111111111111111111111111111111111" },
  amountMon: "10",
  deadline: new Date(Date.now() + 86_400_000).toISOString(),
  status: "Accepted",
  description: "Logo para cafetería",
  evidenceUrl: null,
  providerNote: null,
  rulesHash: null,
  createTx: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  latestVerdict: null,
  iRated: false,
  rules: [],
  decisions: [],
  ratings: [],
  canRate: false,
} as unknown as AgreementDetailDto;

afterEach(() => {
  cleanup();
  state.send.mockReset();
  state.api.mockReset();
});

async function openForm() {
  state.api.mockResolvedValue({ agreement });
  render(<PactDetail id="a1" />);
  await screen.findByRole("heading", { name: "Registrar entrega" });
  fireEvent.change(screen.getByLabelText(/Enlace a la evidencia/), {
    target: { value: "https://example.com/entrega" },
  });
}

describe("registrar entrega", () => {
  it("avisa cuántos bytes ocupa la nota y deja firmar dentro del límite del contrato", async () => {
    await openForm();
    fireEvent.change(screen.getByLabelText(/Nota de entrega/), { target: { value: "Entrego el logo en PNG y SVG." } });
    expect(screen.getByText(/de 500 bytes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Firmar entrega" })).toBeEnabled();
  });

  it("bloquea una nota que supera los 500 bytes del contrato, con tildes incluidas", async () => {
    await openForm();
    fireEvent.change(screen.getByLabelText(/Nota de entrega/), { target: { value: "ñ".repeat(300) } });
    expect(screen.getByRole("alert")).toHaveTextContent("600 de 500 bytes");
    const submit = screen.getByRole("button", { name: "Firmar entrega" });
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(state.send).not.toHaveBeenCalled();
  });

  it("firma on-chain con la nota cuando cabe", async () => {
    state.send.mockResolvedValue("0xabc1234567");
    await openForm();
    fireEvent.change(screen.getByLabelText(/Nota de entrega/), { target: { value: "Listo, entregado." } });
    fireEvent.click(screen.getByRole("button", { name: "Firmar entrega" }));
    await waitFor(() => expect(state.send).toHaveBeenCalledTimes(1));
    expect(state.send.mock.calls[0][0]).toBe("registerDelivery");
    expect(state.send.mock.calls[0][1]).toEqual(["4", "https://example.com/entrega", "Listo, entregado."]);
  });
});
