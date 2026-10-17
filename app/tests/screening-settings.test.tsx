import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreeningSettings } from "@/components/ScreeningSettings";

const state = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("@/lib/client/api", () => ({
  api: state.api,
  jsonRequest: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  state.api.mockImplementation(async (_path: string, init?: { method: string }) =>
    init?.method === "PUT"
      ? { settings: { mode: "auto", criteria: "Con portafolio" } }
      : { settings: { mode: "assist", criteria: "" } },
  );
});

afterEach(() => {
  cleanup();
  state.api.mockReset();
});

describe("cómo recibes las propuestas", () => {
  it("carga el modo guardado y ofrece los tres modos", async () => {
    render(<ScreeningSettings />);
    await waitFor(() => expect(screen.getByRole("radio", { name: /Evaluar y recomendar/ })).toBeEnabled());
    expect(screen.getByRole("radio", { name: /Evaluar y recomendar/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Decidir por mí/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Solo yo/ })).not.toBeChecked();
  });

  it("guarda el modo y los criterios elegidos", async () => {
    render(<ScreeningSettings />);
    await waitFor(() => expect(screen.getByRole("radio", { name: /Decidir por mí/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: /Decidir por mí/ }));
    fireEvent.change(screen.getByLabelText(/Tus criterios/), { target: { value: "Con portafolio" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(state.api).toHaveBeenCalledWith("/api/settings/screening", {
        method: "PUT",
        body: JSON.stringify({ mode: "auto", criteria: "Con portafolio" }),
      }),
    );
  });

  it("sin evaluación no permite escribir criterios", async () => {
    render(<ScreeningSettings />);
    await waitFor(() => expect(screen.getByRole("radio", { name: /Solo yo/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: /Solo yo/ }));
    expect(screen.getByLabelText(/Tus criterios/)).toBeDisabled();
  });
});
