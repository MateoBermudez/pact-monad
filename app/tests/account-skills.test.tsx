import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Account from "@/components/pages/Account";
import { PublicProfile } from "@/components/pages/Portfolio";
import type { ProfileDto, SkillDto } from "@/lib/shared/profile";
vi.mock("next/navigation", () => ({
  usePathname: () => "/cuenta",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/client/pact-context", () => ({
  usePact: () => ({ connected: false, connectWallet: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const catalog: SkillDto[] = [
  { slug: "ui", name: "Diseño UI/UX", category: "Diseño" },
  { slug: "web", name: "Desarrollo web", category: "Desarrollo" },
];
const initial: ProfileDto = {
  id: "account",
  username: "maryhug",
  roles: ["provider"],
  wallet: null,
  displayName: "Maryhug",
  avatarUrl: null,
  location: null,
  availability: "available",
  links: [],
  headline: null,
  bio: null,
  keywords: ["Fotografía"],
  isAgent: false,
  skills: [{ ...catalog[0], level: 4 }],
  reputation: {
    providerRatings: 0,
    providerAverage: null,
    providerScore: 0,
    clientRatings: 0,
    clientScore: 0,
    completedAsProvider: 0,
  },
};
const reply = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
describe("habilidades en Mi cuenta", () => {
  it("muestra las habilidades personalizadas también en el perfil público", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply({ profile: { ...initial, portfolio: [] } })),
    );
    render(<PublicProfile id="maryhug" />);
    expect(await screen.findByText("Fotografía")).toBeInTheDocument();
    expect(screen.getByText("Diseño UI/UX · nivel 4/5")).toBeInTheDocument();
  });
  it("muestra las registradas, permite editarlas y las conserva al volver a cargar", async () => {
    let profile = structuredClone(initial);
    const fetcher = vi.fn((path: string, init?: RequestInit) => {
      if (path === "/api/skills") return reply({ skills: catalog });
      if (path === "/api/auth/identities") return reply({ identities: [] });
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as {
          skills: { slug: string; level: number }[];
          keywords: string[];
        };
        profile = {
          ...profile,
          skills: body.skills.map((skill) => ({
            ...catalog.find((item) => item.slug === skill.slug)!,
            level: skill.level,
          })),
          keywords: body.keywords,
        };
      }
      return reply({ profile });
    });
    vi.stubGlobal("fetch", fetcher);
    const view = render(<Account />);
    expect(await screen.findByLabelText("Nivel de Diseño UI/UX")).toHaveValue(
      "4",
    );
    expect(
      screen.getByRole("button", { name: "Quitar habilidad Fotografía" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nivel de Diseño UI/UX"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar habilidad Fotografía" }),
    );
    fireEvent.change(screen.getByLabelText("Añadir una habilidad"), {
      target: { value: "Desarrollo" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Desarrollo web" }),
    );
    fireEvent.change(screen.getByLabelText("Añadir una habilidad"), {
      target: { value: "Ilustración editorial" },
    });
    fireEvent.keyDown(screen.getByLabelText("Añadir una habilidad"), {
      key: "Enter",
    });
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
    await screen.findByText("Perfil actualizado.");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining(
          '"skills":[{"slug":"ui","level":2},{"slug":"web","level":3}]',
        ),
      }),
    );
    expect(profile.keywords).toEqual(["Ilustración editorial"]);
    view.unmount();
    render(<Account />);
    expect(await screen.findByLabelText("Nivel de Diseño UI/UX")).toHaveValue(
      "2",
    );
    expect(screen.getByLabelText("Nivel de Desarrollo web")).toHaveValue("3");
    expect(
      screen.getByRole("button", {
        name: "Quitar habilidad Ilustración editorial",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quitar habilidad Fotografía" }),
    ).not.toBeInTheDocument();
  }, 30000);
  it("mantiene las habilidades aunque falle el catálogo y conserva los cambios si falla el guardado", async () => {
    const fetcher = vi.fn((path: string, init?: RequestInit) => {
      if (path === "/api/skills")
        return reply({ message: "Sin catálogo" }, 503);
      if (path === "/api/auth/identities") return reply({ identities: [] });
      if (init?.method === "PUT")
        return reply({ message: "No se pudo guardar ahora." }, 503);
      return reply({ profile: initial });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<Account />);
    expect(await screen.findByLabelText("Nivel de Diseño UI/UX")).toHaveValue(
      "4",
    );
    await screen.findByRole("button", { name: "Reintentar catálogo" });
    fireEvent.change(screen.getByLabelText("Nivel de Diseño UI/UX"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Añadir una habilidad"), {
      target: { value: "diseño ui/ux" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(
      screen.getByText("Esa habilidad ya está en tu perfil."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
    await screen.findByText("No se pudo guardar ahora.");
    expect(screen.getByLabelText("Nivel de Diseño UI/UX")).toHaveValue("5");
    expect(
      screen.getByRole("button", { name: "Quitar habilidad Fotografía" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Perfil actualizado.")).not.toBeInTheDocument();
  });
  it("envía listas vacías para quitar las habilidades sin borrar otros campos del perfil", async () => {
    const fetcher = vi.fn((path: string) =>
      path === "/api/skills"
        ? reply({ skills: catalog })
        : path === "/api/auth/identities"
          ? reply({ identities: [] })
          : reply({ profile: initial }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<Account />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Quitar habilidad Diseño UI/UX",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar habilidad Fotografía" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"skills":[],"keywords":[]'),
        }),
      ),
    );
  });
});
