import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewListing } from "@/components/pages/Listings";

const state = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/Workspace", () => ({
  Workspace: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useResource: vi.fn(),
  LoadState: () => null,
  Empty: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Metric: () => null,
  messageOf: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));
vi.mock("@/components/FileUpload", () => ({ FileUpload: () => <div data-testid="subida" /> }));
vi.mock("@/lib/client/api", () => ({
  api: state.api,
  jsonRequest: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));

afterEach(() => {
  cleanup();
  state.api.mockReset();
  state.push.mockReset();
});

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText("¿Qué necesitas?"), { target: { value } });

describe("nueva solicitud", () => {
  it("explica por qué no se puede continuar mientras el texto es corto", () => {
    render(<NewListing />);
    expect(screen.getByRole("status")).toHaveTextContent("Escribe al menos 10 caracteres o adjunta un archivo");
    type("dddd");
    expect(screen.getByRole("status")).toHaveTextContent("Escribe 6 caracteres más (mínimo 10)");
    expect(screen.getByRole("button", { name: "Completar manualmente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Estructurar con IA" })).toBeDisabled();
  });

  it("con 10 caracteres habilita los botones y quita el aviso", () => {
    render(<NewListing />);
    type("Necesito un logo");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Completar manualmente" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Estructurar con IA" })).toBeEnabled();
  });

  it("completar manualmente crea el borrador sin llamar a la IA y abre la solicitud", async () => {
    state.api.mockResolvedValue({ listing: { id: "abc" } });
    render(<NewListing />);
    type("Necesito un logo para mi cafetería");
    fireEvent.click(screen.getByRole("button", { name: "Completar manualmente" }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/solicitudes/abc"));
    expect(state.api).toHaveBeenCalledTimes(1);
    expect(state.api.mock.calls[0][0]).toBe("/api/listings");
  });
});
