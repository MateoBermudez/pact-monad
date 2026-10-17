import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/NotificationBell";
import type { NotificationDto } from "@/lib/shared/notifications";

const state = vi.hoisted(() => ({
  signedIn: true,
  items: [] as NotificationDto[],
  unread: 0,
  markAllRead: vi.fn(),
}));

vi.mock("@/lib/client/pact-context", () => ({ usePact: () => ({ signedIn: state.signedIn }) }));
vi.mock("@/lib/client/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/lib/client/use-notifications", () => ({
  useNotifications: () => ({ items: state.items, unread: state.unread, markAllRead: state.markAllRead }),
}));

afterEach(() => {
  cleanup();
  state.signedIn = true;
  state.items = [];
  state.unread = 0;
  state.markAllRead.mockReset();
});

const item = (overrides: Partial<NotificationDto> = {}): NotificationDto => ({
  id: "1",
  type: "listing.matched",
  title: "Nueva solicitud para ti: Logo para cafetería",
  body: "Necesito un logo y branding",
  listingId: "abc",
  data: { reasons: ["Coincide en: logo, branding", "Categoría: Diseño"], score: 76 },
  createdAt: "2026-10-17T15:00:00.000Z",
  readAt: null,
  ...overrides,
});

describe("campanita de notificaciones", () => {
  it("no aparece sin sesión", () => {
    state.signedIn = false;
    render(<NotificationBell />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("muestra cuántas hay sin leer", () => {
    state.unread = 3;
    render(<NotificationBell />);
    expect(screen.getByRole("button", { name: "Notificaciones, 3 sin leer" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("limita el contador a 9+", () => {
    state.unread = 25;
    render(<NotificationBell />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("explica cuándo llegarán avisos si todavía no hay ninguno", () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    expect(screen.getByText(/cuando llegue una solicitud que encaje con tu perfil/)).toBeInTheDocument();
  });

  it("muestra la solicitud, por qué encaja y permite marcar todo como leído", () => {
    state.unread = 1;
    state.items = [item()];
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: /Notificaciones/ }));
    expect(screen.getByText("Nueva solicitud para ti: Logo para cafetería")).toBeInTheDocument();
    expect(screen.getByText("Coincide en: logo, branding · Categoría: Diseño")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar todo como leído" }));
    expect(state.markAllRead).toHaveBeenCalledTimes(1);
  });

  it("no ofrece marcar como leído cuando no hay nada sin leer", () => {
    state.items = [item({ readAt: "2026-10-17T15:01:00.000Z" })];
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    expect(screen.queryByRole("button", { name: "Marcar todo como leído" })).toBeNull();
  });
});
