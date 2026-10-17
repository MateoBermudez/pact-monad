import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Coins, FlaskConical, Home, LayoutGrid, LogOut, Plus, Settings, Wallet, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { CLIENT, PROVIDER, short, useDemo, type Role, type Status } from "@/lib/demo";
import { CountUp } from "@/components/Effects";

export function Header() {
  const { address, connected, setConnected, wrongNetwork, switchNetwork, balance } = useDemo();
  return (
    <>
      <AnimatePresence>
        {connected && wrongNetwork && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-warning/15 text-warning"
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Estás en otra red. Cambia a Monad Testnet
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
          <Link to="/" className="press flex shrink-0 items-center gap-1.5" aria-label="PACT — Inicio">
            <img src="/pact-logo.svg" alt="" aria-hidden="true" width={40} height={40} className="h-10 w-auto" />
            <img src="/pact-letra.svg" alt="PACT" width={75} height={28} className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-card/80 px-4 text-xs text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${wrongNetwork && connected ? "bg-warning" : "bg-success"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${wrongNetwork && connected ? "bg-warning" : "bg-success"}`} />
              </span>
              <span className="hidden sm:inline">Monad Testnet</span>
              <span className="sm:hidden">Testnet</span>
            </span>
            {connected ? (
              <div className="flex items-center gap-1 rounded-full bg-ink py-1 pl-1 pr-1 text-ink-foreground">
                <span className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-ink ring-2 ring-primary/40" />
                <span className="hidden px-1.5 font-mono text-xs sm:inline">{short(address)}</span>
                <span className="rounded-full bg-primary px-2.5 py-1.5 text-xs font-bold text-ink">
                  <CountUp value={balance} /> MON
                </span>
                <button onClick={() => setConnected(false)} aria-label="Desconectar" className="press rounded-full p-1.5 text-ink-foreground/60 hover:text-ink-foreground">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link to="/conectar" className="btn-primary h-10 px-4 py-0 text-xs">
                <Wallet className="h-4 w-4" /> Conectar MetaMask
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

const DOCK: { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { to: "/", label: "Inicio", icon: Home, match: (p) => p === "/" },
  { to: "/dashboard", label: "Acuerdos", icon: LayoutGrid, match: (p) => p.startsWith("/dashboard") || p.startsWith("/pact") },
  { to: "/crear", label: "Crear", icon: Plus, match: (p) => p.startsWith("/crear") },
  { to: "/configuracion", label: "Ajustes", icon: Settings, match: (p) => p.startsWith("/configuracion") },
];

/** Floating pill navigation: the active item grows into a lime capsule with its label. */
export function Dock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
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
                to={d.to}
                onClick={() => {
                  if (d.to === "/crear") {
                    window.dispatchEvent(new CustomEvent("pact:reset-crear"));
                  }
                }}
                aria-label={d.label}
                aria-current={active ? "page" : undefined}
                className={`press relative flex h-12 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-bold transition-colors ${
                  active ? "text-ink" : "text-ink-foreground/70 hover:text-ink-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="dock-active"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  />
                )}
                <motion.span className="relative z-10" whileHover={{ scale: 1.15, rotate: d.icon === Settings ? 60 : 0 }} whileTap={{ scale: 0.8 }}>
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
  const { connected } = useDemo();
  if (connected) return <>{children}</>;
  return (
    <div className="card mx-auto max-w-md space-y-4 py-10 text-center">
      <span className="ill-bob mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink">
        <Wallet className="h-6 w-6 text-primary" />
      </span>
      <h1 className="font-display text-xl font-bold">Conecta tu wallet para continuar</h1>
      <p className="text-sm text-muted-foreground">Tu wallet es tu identidad en PACT. Sin contraseñas ni correos.</p>
      <Link to="/conectar" className="btn-primary">Conectar MetaMask</Link>
    </div>
  );
}

const sel = "w-full rounded-lg border border-white/10 bg-white/5 text-ink-foreground px-2 py-1.5 text-xs";

export function DemoPanel() {
  const d = useDemo();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pactId = path.startsWith("/pact/") ? path.split("/")[2] : null;
  const pact = pactId ? d.pacts.find((p) => p.id === pactId) : undefined;
  return (
    <div className="fixed bottom-24 right-3 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="w-56 origin-bottom-right rounded-2xl border border-white/10 bg-ink p-3 text-ink-foreground shadow-2xl"
          >
            <div className="space-y-2 text-xs">
              {pact && (
                <>
                  <label className="block">
                    <span className="text-ink-foreground/60">Rol</span>
                    <select className={sel} value={pact.role} onChange={(e) => d.updatePact(pact.id, { role: e.target.value as Role })}>
                      <option value="cliente">Cliente</option>
                      <option value="proveedor">Proveedor</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-ink-foreground/60">Estado</span>
                    <select className={sel} value={pact.status} onChange={(e) => d.updatePact(pact.id, { status: e.target.value as Status })}>
                      {["Creado", "Aceptado", "Entregado", "Aprobado", "Cancelado"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <Toggle label="Wallet conectada" v={d.connected} set={d.setConnected} />
              <Toggle label="Red incorrecta" v={d.wrongNetwork} set={d.setWrongNetwork} />
              {path === "/crear" && <Toggle label="Simular fallo IA" v={d.aiFail} set={d.setAiFail} />}
              <button
                onClick={() => d.receive(10, PROVIDER, "Logo para una cafetería")}
                className="press flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-ink"
              >
                <Coins className="h-3.5 w-3.5" /> Simular pago entrante
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="press flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-lg"
      >
        {open ? <X className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />} Solo demo
      </button>
    </div>
  );
}

function Toggle({ label, v, set }: { label: string; v: boolean; set: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-ink-foreground/70">{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="accent-primary" />
    </label>
  );
}
