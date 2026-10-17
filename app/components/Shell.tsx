"use client";
import Image from "next/image";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Home,
  Compass,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode } from "react";
import { short, usePact } from "@/lib/client/pact-context";
import { useHydrated } from "@/lib/client/use-hydrated";
import { CountUp } from "@/components/Effects";
import { NotificationBell } from "@/components/NotificationBell";

export function Header({ minimal = false }: { minimal?: boolean }) {
  const router = useRouter();
  const {
    address,
    connected,
    setConnected,
    wrongNetwork,
    switchNetwork,
    balance,
    signedIn: sessionActive,
    loading: sessionLoading,
    logout,
  } = usePact();
  const hydrated = useHydrated();
  const loading = !hydrated || sessionLoading;
  const signedIn = hydrated && sessionActive;
  return (
    <>
      <AnimatePresence>
        {!minimal && connected && wrongNetwork && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-warning/15 text-warning"
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Estás en otra red. Cambia
                a Monad Testnet
              </span>
              <button
                onClick={() => void switchNetwork()}
                className="press rounded-full bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground"
              >
                Cambiar red
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pb-2 pt-4">
          <Link
            href="/"
            className="press flex shrink-0 items-center gap-1.5"
            aria-label="PACT — Inicio"
          >
            <Image
              unoptimized
              src="/pact-logo.svg"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <Image
              unoptimized
              src="/pact-letra.svg"
              alt="PACT"
              width={75}
              height={28}
              className="h-7 w-auto"
            />
          </Link>
          {!minimal && (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href="/cuenta"
              aria-label="Mi perfil"
              className="rounded-full bg-primary/30 p-2"
            >
              <User className="h-5 w-5" />
            </Link>
            {signedIn && (
              <button
                type="button"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={() => void logout().then(() => router.replace("/iniciar-sesion"))}
                className="press rounded-full bg-primary/30 p-2"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-card/80 px-4 text-xs text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${wrongNetwork && connected ? "bg-warning" : "bg-success"}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${wrongNetwork && connected ? "bg-warning" : "bg-success"}`}
                />
              </span>
              <span className="hidden sm:inline">Monad Testnet</span>
              <span className="sm:hidden">Testnet</span>
            </span>
            {connected ? (
              <div className="flex items-center gap-1 rounded-full bg-ink py-1 pl-1 pr-1 text-ink-foreground">
                <span className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-ink ring-2 ring-primary/40" />
                <span className="hidden px-1.5 font-mono text-xs sm:inline">
                  {short(address)}
                </span>
                <span className="rounded-full bg-primary px-2.5 py-1.5 text-xs font-bold text-ink">
                  <CountUp value={balance} /> MON
                </span>
                <button
                  onClick={() => setConnected(false)}
                  aria-label="Desconectar"
                  className="press rounded-full p-1.5 text-ink-foreground/60 hover:text-ink-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href={signedIn ? "/conectar" : "/iniciar-sesion"}
                className="btn-primary h-10 px-4 py-0 text-xs"
              >
                <Wallet className="h-4 w-4" />{" "}
                {loading
                  ? "Cargando…"
                  : signedIn
                    ? "Conectar MetaMask"
                    : "Iniciar sesión"}
              </Link>
            )}
          </div>
          )}
        </div>
      </header>
    </>
  );
}

const DOCK: {
  to: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}[] = [
  { to: "/", label: "Inicio", icon: Home, match: (p) => p === "/" },
  { to: "/explorar", label: "Explorar", icon: Compass, match: (p) => ["/explorar", "/solicitudes", "/postulaciones", "/personas"].some(prefix=>p.startsWith(prefix)) },
  {
    to: "/dashboard",
    label: "Acuerdos",
    icon: LayoutGrid,
    match: (p) => p.startsWith("/dashboard") || p.startsWith("/pact"),
  },
  {
    to: "/crear",
    label: "Crear",
    icon: Plus,
    match: (p) => p.startsWith("/crear"),
  },
  {
    to: "/configuracion",
    label: "Ajustes",
    icon: Settings,
    match: (p) => p.startsWith("/configuracion"),
  },
];

/** Floating pill navigation: the active item grows into a lime capsule with its label. */
export function Dock() {
  const path = usePathname();
  return (
    <motion.nav
      aria-label="Navegación principal"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    >
      <ul className="flex items-center gap-1 rounded-full bg-ink p-1.5 shadow-[0_18px_40px_-10px_oklch(0.19_0.01_120/0.55)] ring-1 ring-white/10">
        {DOCK.map((d) => {
          const active = d.match(path);
          return (
            <li key={d.to}>
              <Link
                href={d.to}
                onClick={() => {
                  if (d.to === "/crear") {
                    window.dispatchEvent(new CustomEvent("pact:reset-crear"));
                  }
                }}
                aria-label={d.label}
                aria-current={active ? "page" : undefined}
                className={`press relative flex h-12 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-bold transition-colors ${
                  active
                    ? "text-ink"
                    : "text-ink-foreground/70 hover:text-ink-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="dock-active"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  />
                )}
                <motion.span
                  className="relative z-10"
                  whileHover={{
                    scale: 1.15,
                    rotate: d.icon === Settings ? 60 : 0,
                  }}
                  whileTap={{ scale: 0.8 }}
                >
                  <d.icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
                </motion.span>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.span
                      key="label"
                      className="relative z-10 overflow-hidden whitespace-nowrap"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {d.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}

/** Shows a MetaMask sign-in prompt instead of the page when no wallet is connected. */
export function ConnectGate({ children }: { children: ReactNode }) {
  const { signedIn, loading: sessionLoading } = usePact();
  const hydrated = useHydrated();
  const loading = !hydrated || sessionLoading;
  if (loading)
    return (
      <p role="status" className="card text-sm">
        Cargando tu sesión…
      </p>
    );
  if (signedIn) return <>{children}</>;
  return (
    <div className="card mx-auto max-w-md space-y-4 py-10 text-center">
      <span className="ill-bob mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink">
        <Wallet className="h-6 w-6 text-primary" />
      </span>
      <h1 className="font-display text-xl font-bold">
        Inicia sesión para continuar
      </h1>
      <p className="text-sm text-muted-foreground">
        Accede con Google o GitHub. Después podrás vincular tu wallet para las
        transacciones.
      </p>
      <Link href="/iniciar-sesion" className="btn-primary">
        Iniciar sesión
      </Link>
    </div>
  );
}
