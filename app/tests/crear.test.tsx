import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import Index from "@/components/pages/Index";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  publishListing: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/client/pact-context", () => ({
  usePact: () => ({
    aiFail: false,
    signIn: vi.fn(),
    refresh: vi.fn().mockResolvedValue([]),
    connected: false,
    address: "",
    addPact: vi.fn(),
    connectWallet: vi.fn(),
  }),
  short: (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`,
  addDays: () => "20 oct 2026",
}));
vi.mock("@/lib/client/agreement-review", async () => ({
  ...(await vi.importActual<object>("@/lib/shared/agreement-review")),
  structureAgreement: vi.fn(),
  publishListing: state.publishListing,
}));
vi.mock("@/components/SignOverlay", () => ({ SignOverlay: () => null }));
afterEach(() => {
  cleanup();
  state.push.mockReset();
  state.publishListing.mockReset();
});

const PROVIDER = "0x1234567890abcdef1234567890abcdef12345678";

function fillManually() {
  fireEvent.click(screen.getByRole("button", { name: /Completar manualmente/ }));
}

async function fillReview() {
  await screen.findByRole("heading", { name: "Detalles del acuerdo" });
  for (const [label, value] of [
    ["Título del acuerdo", "Logo para cafetería"],
    ["Descripción y entregables", "Diseño del logo en PNG y SVG."],
    ["Monto en MON", "10"],
    ["Plazo de entrega", "3"],
  ] as const) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe("paso Describe", () => {
  it("avisa cuántos caracteres faltan y deja completar manualmente", () => {
    render(<Index />);
    fireEvent.change(screen.getByLabelText("Ejemplo de solicitud"), {
      target: { value: "dddd" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Escribe 6 caracteres más (mínimo 10)",
    );
    expect(
      screen.getByRole("button", { name: /Estructurar con IA/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Completar manualmente/ }),
    ).toBeEnabled();
  });

  it("con 10 caracteres habilita la IA y quita el aviso", () => {
    render(<Index />);
    fireEvent.change(screen.getByLabelText("Ejemplo de solicitud"), {
      target: { value: "Necesito un logo" },
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Estructurar con IA/ }),
    ).toBeEnabled();
  });
});

describe("paso Revisa las condiciones", () => {
  it("abre el formulario manual vacío y conserva la descripción al volver", async () => {
    render(<Index />);
    fireEvent.change(screen.getByLabelText("Ejemplo de solicitud"), {
      target: { value: "Necesito un logo para cafetería" },
    });
    fillManually();
    await screen.findByRole("heading", { name: "Detalles del acuerdo" });
    expect(screen.getByLabelText("Título del acuerdo")).toHaveValue("");
    expect(screen.getByLabelText("Descripción y entregables")).toHaveValue("");
    expect(
      screen.queryByText("Propuesta de IA · Editable"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Revisar y continuar/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Ejemplo de solicitud")).toHaveValue(
        "Necesito un logo para cafetería",
      ),
    );
  });

  it("en una solicitud nueva no pide la wallet del proveedor y sí palabras clave y condiciones", async () => {
    render(<Index />);
    fillManually();
    await fillReview();
    expect(screen.queryByLabelText("Wallet del proveedor")).toBeNull();
    expect(screen.getByLabelText(/Palabras clave/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Condiciones de aceptación/)).toBeInTheDocument();
    const summary = within(
      screen.getByRole("complementary", { name: "Resumen del acuerdo" }),
    );
    expect(summary.getByText("Logo para cafetería")).toBeInTheDocument();
    expect(summary.getByText("10 MON")).toBeInTheDocument();
    expect(summary.getByText("Presupuesto")).toBeInTheDocument();
    expect(summary.queryByText("Proveedor")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Revisar y continuar/ }),
    ).toBeEnabled();
  });

  it("rechaza condiciones demasiado cortas", async () => {
    render(<Index />);
    fillManually();
    await fillReview();
    fireEvent.change(screen.getByLabelText(/Condiciones de aceptación/), {
      target: { value: "ok" },
    });
    expect(
      screen.getByRole("button", { name: /Revisar y continuar/ }),
    ).toBeDisabled();
    expect(screen.getAllByText(/de 5 a 300 caracteres/).length).toBeGreaterThan(0);
  });

  it("en el acuerdo directo con proveedor conocido sigue validando la wallet", async () => {
    render(<Index initialProvider={PROVIDER} />);
    fillManually();
    await fillReview();
    expect(screen.getByLabelText("Wallet del proveedor")).toHaveValue(PROVIDER);
    const next = screen.getByRole("button", { name: /Revisar y continuar/ });
    expect(next).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Wallet del proveedor"), {
      target: { value: "0x" + "0".repeat(40) },
    });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Wallet del proveedor"), {
      target: { value: PROVIDER },
    });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await screen.findByRole("heading", { name: "Resumen del acuerdo" });
  });
});

describe("paso Publica", () => {
  it("publica la oportunidad sin MetaMask y abre la solicitud", async () => {
    state.publishListing.mockResolvedValue("sol-1");
    render(<Index />);
    fillManually();
    await fillReview();
    fireEvent.change(screen.getByLabelText(/Palabras clave/), {
      target: { value: "Logo, Branding, logo" },
    });
    fireEvent.change(screen.getByLabelText(/Condiciones de aceptación/), {
      target: { value: "Incluye el logo en PNG y SVG" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Revisar y continuar/ }));
    await screen.findByRole("button", { name: /Publicar oportunidad/ });
    expect(screen.queryByText(/Conectar MetaMask/)).toBeNull();
    expect(screen.queryByText(/bloquear 10 MON/)).toBeNull();
    expect(screen.getByText("Fondos bloqueados ahora")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Publicar oportunidad/ }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/solicitudes/sol-1"));
    expect(state.publishListing).toHaveBeenCalledTimes(1);
    expect(state.publishListing.mock.calls[0][0]).toMatchObject({
      title: "Logo para cafetería",
      amountMon: 10,
      days: 3,
      keywords: ["logo", "branding"],
      rules: [{ criterion: "Incluye el logo en PNG y SVG", weight: 3 }],
    });
  });

  it("si publicar falla muestra el error y deja reintentar", async () => {
    state.publishListing.mockRejectedValueOnce(new Error("Sin conexión"));
    state.publishListing.mockResolvedValueOnce("sol-2");
    render(<Index />);
    fillManually();
    await fillReview();
    fireEvent.click(screen.getByRole("button", { name: /Revisar y continuar/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Publicar oportunidad/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    expect(state.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Publicar oportunidad/ }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/solicitudes/sol-2"));
    expect(state.publishListing.mock.calls[1][0].rules).toEqual([
      expect.objectContaining({ criterion: expect.stringContaining("cumple") }),
    ]);
  });
});
