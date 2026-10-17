import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WelcomeTour } from "@/components/WelcomeTour";

vi.mock("next/navigation", () => ({ usePathname: () => "/bienvenida" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("permite recorrer los pasos, volver y salir sin conectar la wallet", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ profile: { roles: ["client", "provider"] } }));
  vi.stubGlobal("fetch", fetcher);
  render(<WelcomeTour />);
  expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  expect(screen.getByRole("link", { name: /Omitir recorrido/ })).toHaveAttribute("href", "/dashboard");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Una idea clara");
  expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu próximo proyecto");
  fireEvent.click(screen.getByRole("button", { name: /Paso 4:/ }));
  expect(await screen.findByRole("link", { name: /Publicar una solicitud/ })).toHaveAttribute("href", "/crear");
  expect(screen.getByRole("link", { name: /Explorar oportunidades/ })).toHaveAttribute("href", "/explorar");
  expect(screen.getByRole("link", { name: /Entrar a PACT/ })).toHaveAttribute("href", "/dashboard");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("muestra los accesos finales adecuados al rol y permite salir si falla la consulta", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ profile: { roles: ["provider"] } })));
  render(<WelcomeTour />);
  fireEvent.click(screen.getByRole("button", { name: /Paso 4:/ }));
  await waitFor(() => expect(screen.queryByRole("link", { name: /Publicar una solicitud/ })).toBeNull());
  expect(screen.getByRole("link", { name: /Explorar oportunidades/ })).toBeInTheDocument();
  cleanup();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<WelcomeTour />);
  fireEvent.click(screen.getByRole("button", { name: /Paso 4:/ }));
  expect(screen.getByRole("link", { name: /Entrar a PACT/ })).toHaveAttribute("href", "/dashboard");
});
