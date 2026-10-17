import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Landing from "@/components/pages/Landing";
import type { Pact } from "@/lib/shared/ui-pact";

const state = vi.hoisted(() => ({ signedIn: false, pacts: [] as Pact[] }));

const MOTION_PROPS = ["variants", "initial", "animate", "whileInView", "whileHover", "viewport", "transition"];

vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
          createElement(
            tag,
            Object.fromEntries(Object.entries(rest).filter(([key]) => !MOTION_PROPS.includes(key))),
            children,
          ),
    },
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/Illustrations", () => ({ IllustrationHero: () => <div data-testid="ilustracion" /> }));
vi.mock("@/lib/client/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/lib/client/pact-context", () => ({
  usePact: () => ({ signedIn: state.signedIn, pacts: state.pacts }),
}));

afterEach(() => {
  cleanup();
  state.signedIn = false;
  state.pacts = [];
});

const pact = (overrides: Partial<Pact>): Pact => ({
  id: "1",
  title: "Logo",
  description: "Logo para cafetería",
  amount: 10,
  days: 5,
  role: "cliente",
  counterparty: "0xabc",
  status: "Creado",
  createdAt: "17 oct 2026",
  createTx: null,
  ...overrides,
});

describe("landing para quien no inició sesión", () => {
  it("muestra los datos genéricos y los botones de iniciar sesión y registrarse", () => {
    render(<Landing />);
    expect(screen.getByText("pasos para crear")).toBeInTheDocument();
    expect(screen.getByText("de Monad Testnet")).toBeInTheDocument();
    expect(screen.getByText("para confirmar")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Iniciar sesión" })[0]).toHaveAttribute("href", "/iniciar-sesion");
    expect(screen.getByRole("link", { name: "Crear una cuenta" })).toHaveAttribute("href", "/registro");
    expect(screen.getAllByRole("link", { name: /Registrarme/ }).length).toBeGreaterThan(0);
  });

  it("no muestra nada de la cuenta ni de acuerdos", () => {
    state.pacts = [pact({ status: "Entregado" })];
    render(<Landing />);
    expect(screen.queryByText("acuerdos en curso")).toBeNull();
    expect(screen.queryByText("Ir al dashboard")).toBeNull();
    expect(screen.queryByText("Ver mis acuerdos")).toBeNull();
  });
});

describe("landing para quien inició sesión", () => {
  it("muestra los números reales de sus acuerdos en lugar de los genéricos", () => {
    state.signedIn = true;
    state.pacts = [
      pact({ id: "1", role: "cliente", status: "Entregado", amount: 10 }),
      pact({ id: "2", role: "cliente", status: "Creado", amount: 5 }),
      pact({ id: "3", role: "proveedor", status: "Aprobado", amount: 7 }),
    ];
    render(<Landing />);
    expect(screen.getByText("acuerdos en curso").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("requieren tu acción").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("bloqueados en escrow").previousSibling).toHaveTextContent("15 MON");
    expect(screen.getByText("cobrados como proveedor").previousSibling).toHaveTextContent("7 MON");
    expect(screen.queryByText("pasos para crear")).toBeNull();
  });

  it("sigue mostrando la landing, con los accesos al dashboard y a crear", () => {
    state.signedIn = true;
    render(<Landing />);
    expect(screen.getByRole("link", { name: "Ver mis acuerdos" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Crear un acuerdo" })).toHaveAttribute("href", "/crear");
    expect(screen.getByRole("link", { name: /Ir al dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Registrarme" })).toBeNull();
  });

  it("con cero acuerdos muestra ceros, no los datos genéricos", () => {
    state.signedIn = true;
    render(<Landing />);
    expect(screen.getByText("acuerdos en curso").previousSibling).toHaveTextContent("0");
    expect(screen.getByText("bloqueados en escrow").previousSibling).toHaveTextContent("0 MON");
  });
});
