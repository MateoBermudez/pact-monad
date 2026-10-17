import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { Index } from "@/routes/crear";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/demo", () => ({
  useDemo: () => ({
    aiFail: false,
    connected: false,
    address: "",
    addPact: vi.fn(),
    connectWallet: vi.fn(),
  }),
  short: (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`,
  addDays: () => "20 oct 2026",
}));
vi.mock("@/components/SignOverlay", () => ({ SignOverlay: () => null }));
afterEach(cleanup);

describe("paso Revisa las condiciones", () => {
  it("abre el formulario manual vacío y conserva la descripción al volver", async () => {
    render(<Index />);
    fireEvent.change(screen.getByLabelText("Ejemplo de solicitud"), {
      target: { value: "Necesito un logo para cafetería" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Completar manualmente/ }));
    await screen.findByRole("heading", { name: "Detalles del acuerdo" });
    expect(screen.getByLabelText("Título del acuerdo")).toHaveValue("");
    expect(screen.getByLabelText("Descripción y entregables")).toHaveValue("");
    expect(screen.queryByText("Propuesta de IA · Editable")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar y continuar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Ejemplo de solicitud")).toHaveValue(
        "Necesito un logo para cafetería",
      ),
    );
  });
  it("actualiza el resumen y solo permite continuar con datos y proveedor válidos", async () => {
    render(<Index />);
    fireEvent.click(screen.getByRole("button", { name: /Completar manualmente/ }));
    await screen.findByRole("heading", { name: "Detalles del acuerdo" });
    for (const [label, value] of [
      ["Título del acuerdo", "Logo para cafetería"],
      ["Descripción y entregables", "Diseño del logo en PNG y SVG."],
      ["Monto en MON", "10"],
      ["Plazo de entrega", "3"],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const summary = within(screen.getByRole("complementary", { name: "Resumen del acuerdo" }));
    expect(summary.getByText("Logo para cafetería")).toBeInTheDocument();
    expect(summary.getByText("10 MON")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /Revisar y continuar/ });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Wallet del proveedor"), {
      target: { value: "0x" + "0".repeat(40) },
    });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Wallet del proveedor"), {
      target: { value: "0x1234567890abcdef1234567890abcdef12345678" },
    });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await screen.findByRole("heading", { name: "Resumen del acuerdo" });
  });
});
