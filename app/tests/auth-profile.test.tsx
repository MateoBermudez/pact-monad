import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SocialAuth } from "@/components/SocialAuth";
import { ProfileSetup } from "@/components/ProfileSetup";
import { LegalDocument } from "@/components/LegalDocument";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});
const reply = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
describe("acceso y perfil", () => {
  it("no simula un acceso cuando el backend social no está disponible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply({}, 404)),
    );
    render(<SocialAuth register />);
    expect(screen.getByRole("link", { name: "Términos" })).toHaveAttribute(
      "href",
      "/terminos",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Registrarme con Google" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "aún no está disponible",
    );
    expect(push).not.toHaveBeenCalled();
  });
  it("actualiza la vista previa y guarda habilidades del catálogo y palabras clave sin inventar slugs", async () => {
    const fetcher = vi.fn((path: string, init?: RequestInit) => {
      if (path === "/api/skills")
        return reply({
          skills: [{ slug: "design", name: "Diseño", category: "Arte" }],
        });
      if (path === "/api/profile" && !init?.method)
        return reply({
          profile: {
            username: "mateo",
            skills: [{ slug: "design", name: "Diseño", level: 4 }],
            keywords: [],
            headline: null,
          },
        });
      return reply({});
    });
    vi.stubGlobal("fetch", fetcher);
    render(<ProfileSetup />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre de usuario")).toHaveValue("mateo"),
    );
    fireEvent.change(screen.getByLabelText("Tus habilidades"), {
      target: { value: "Fotografía" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Añadir “Fotografía”" }),
    );
    fireEvent.click(
      screen.getByRole("radio", { name: /Cliente Quiero contratar talento/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y entrar a PACT" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          headline: "Cliente",
          skills: [{ slug: "design", level: 4 }],
          keywords: ["Fotografía"],
        }),
      }),
    );
  });
  it("incluye el responsable y contacto indicados en la política", () => {
    render(<LegalDocument privacy />);
    expect(
      screen.getByRole("link", { name: "mateo_bermudez82231@elpoli.edu.co" }),
    ).toHaveAttribute("href", "mailto:mateo_bermudez82231@elpoli.edu.co");
    expect(
      screen.getByText(/Mateo Bermudez Cuartas · Colombia/),
    ).toBeInTheDocument();
  });
});
