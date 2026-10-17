import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Shell";

const state = vi.hoisted(() => ({
  signedIn: true,
  connected: false,
  logout: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => <span>campanita</span> }));
vi.mock("@/lib/client/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/lib/client/pact-context", () => ({
  short: (value: string) => value,
  usePact: () => ({
    address: "0xabc",
    connected: state.connected,
    setConnected: vi.fn(),
    wrongNetwork: false,
    switchNetwork: vi.fn(),
    balance: 0,
    signedIn: state.signedIn,
    loading: false,
    logout: state.logout,
  }),
}));

afterEach(() => {
  cleanup();
  state.signedIn = true;
  state.connected = false;
  state.logout.mockReset();
  state.replace.mockReset();
});

describe("encabezado", () => {
  it("en las pantallas de acceso muestra solo el logo", () => {
    render(<Header variant="minimal" />);
    expect(screen.getByRole("link", { name: "PACT — Inicio" })).toBeInTheDocument();
    expect(screen.queryByText("campanita")).toBeNull();
    expect(screen.queryByText(/MetaMask/)).toBeNull();
    expect(screen.queryByText(/Testnet/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  it("dentro de la app muestra campanita, red y la conexión con MetaMask", () => {
    render(<Header />);
    expect(screen.getByText("campanita")).toBeInTheDocument();
    expect(screen.getByText("Conectar MetaMask")).toBeInTheDocument();
    expect(screen.getByLabelText("Mi perfil")).toBeInTheDocument();
  });

  it("permite cerrar sesión y vuelve al acceso", async () => {
    state.logout.mockResolvedValue(undefined);
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/iniciar-sesion"));
    expect(state.logout).toHaveBeenCalledTimes(1);
  });

  it("sin sesión no ofrece cerrar sesión", () => {
    state.signedIn = false;
    render(<Header />);
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });
});

describe("encabezado de la landing para invitados", () => {
  it("ofrece iniciar sesión y registrarse, sin nada de la cuenta", () => {
    state.signedIn = false;
    render(<Header variant="guest" />);
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/iniciar-sesion");
    expect(screen.getByRole("link", { name: "Registrarme" })).toHaveAttribute("href", "/registro");
    expect(screen.queryByText("campanita")).toBeNull();
    expect(screen.queryByText(/MetaMask/)).toBeNull();
    expect(screen.queryByText(/Testnet/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });
});
