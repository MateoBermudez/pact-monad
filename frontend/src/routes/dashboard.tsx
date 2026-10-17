import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Coins, Lock, Plus, Settings, Sparkles, Wifi } from "lucide-react";
import { CLIENT, STATUS_BADGE, short, useDemo, type Pact } from "@/lib/demo";
import { ConnectGate } from "@/components/Shell";
import { CountUp } from "@/components/Effects";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "PACT" },
      { name: "description", content: "Sigue todos tus acuerdos con escrow en Monad: en curso, por revisar y completados." },
      { property: "og:title", content: "Dashboard — PACT" },
      { property: "og:description", content: "Todos tus acuerdos de PACT en un solo lugar." },
    ],
  }),
  component: () => (
    <ConnectGate>
      <Dashboard />
    </ConnectGate>
  ),
});

const FILTERS = ["Todos", "En curso", "Requieren acción", "Completados"] as const;
type Filter = (typeof FILTERS)[number];

const active = (p: Pact) => ["Creado", "Aceptado", "Entregado"].includes(p.status);
const needsAction = (p: Pact) =>
  (p.role === "cliente" && p.status === "Entregado") || (p.role === "proveedor" && (p.status === "Creado" || p.status === "Aceptado"));

function Dashboard() {
  const { address, pacts, balance, receive } = useDemo();
  const [filter, setFilter] = useState<Filter>("Todos");
  const [roleF, setRoleF] = useState<"todos" | "cliente" | "proveedor">("todos");

  const locked = pacts.filter((p) => active(p) && p.role === "cliente").reduce((s, p) => s + p.amount, 0);
  const earned = pacts.filter((p) => p.role === "proveedor" && p.status === "Aprobado").reduce((s, p) => s + p.amount, 0);

  const list = pacts.filter((p) => {
    if (roleF !== "todos" && p.role !== roleF) return false;
    if (filter === "En curso") return active(p);
    if (filter === "Requieren acción") return needsAction(p);
    if (filter === "Completados") return !active(p);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-ink ring-2 ring-card" />
          <div>
            <p className="text-xs text-muted-foreground">Bienvenido de vuelta 👋</p>
            <h1 className="font-display text-2xl font-bold leading-tight">Mis acuerdos</h1>
          </div>
        </div>
      </div>

      {/* wallet card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="circuit relative overflow-hidden rounded-[2rem] bg-ink p-5 text-ink-foreground"
        style={{ transformPerspective: 900 }}
      >
        <motion.span
          aria-hidden
          className="absolute right-20 top-6 text-primary"
          animate={{ rotate: [0, 90, 180], scale: [1, 1.3, 1] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <Sparkles className="h-6 w-6" />
        </motion.span>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-ink-foreground/60">Saldo disponible</p>
            <p className="font-display text-4xl font-bold sm:text-5xl">
              <CountUp value={balance} /> <span className="text-xl text-primary">MON</span>
            </p>
          </div>
          <span className="rounded-full bg-primary p-3 text-ink"><Wifi className="h-5 w-5 rotate-90" /></span>
        </div>
        <div className="mt-6 flex items-end justify-between text-xs text-ink-foreground/60">
          <span className="font-mono">{short(address)}</span>
          <span className="flex items-center gap-1.5 text-primary"><Lock className="h-3.5 w-3.5" /> {locked} MON en escrow</span>
        </div>
      </motion.div>

      {/* quick actions */}
      <div className="grid grid-cols-3 justify-items-center gap-2">
        {[
          { to: "/crear", icon: Plus, label: "Nuevo" },
          { to: "/configuracion", icon: Settings, label: "Límite IA" },
        ].map((a, i) => (
          <Link key={a.label} to={a.to}>
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.07, type: "spring", stiffness: 260, damping: 15 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-1.5 text-xs font-semibold"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border"><a.icon className="h-5 w-5" /></span>
              {a.label}
            </motion.div>
          </Link>
        ))}
        <motion.button
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 260, damping: 15 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => receive(5, "0x5B7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3aC03", "Corrección de textos")}
          className="flex flex-col items-center gap-1.5 text-xs font-semibold"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-sm"><Coins className="h-5 w-5" /></span>
          Cobrar
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat v={pacts.filter(active).length} l="En curso" />
        <Stat v={pacts.filter(needsAction).length} l="Requieren acción" highlight />
        <Stat v={`${earned} MON`} l="Cobrado como proveedor" />
        <Stat v={pacts.filter((p) => p.status === "Aprobado").length} l="Completados" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`press relative rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${filter === f ? "text-primary" : "border border-border bg-card text-muted-foreground"}`}>
              {filter === f && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
        <select value={roleF} onChange={(e) => setRoleF(e.target.value as typeof roleF)}
          className="rounded-full border border-border bg-card px-3 py-2 text-xs">
          <option value="todos">Como cliente y proveedor</option>
          <option value="cliente">Solo como cliente</option>
          <option value="proveedor">Solo como proveedor</option>
        </select>
      </div>

      <motion.div layout className="space-y-3">
        {list.length === 0 && <div className="card text-center text-sm text-muted-foreground">No hay acuerdos en esta vista.</div>}
        <AnimatePresence initial>
        {list.map((p, i) => (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, x: -40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 22, delay: Math.min(i, 6) * 0.05 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
          <Link to="/pact/$id" params={{ id: p.id }}
            className="card flex items-center gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">#{p.id}</span>
                <span className={`rounded-full px-2.5 py-0.5 font-semibold ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                <span className="text-muted-foreground">{p.role === "cliente" ? "Eres cliente" : "Eres proveedor"}</span>
                {needsAction(p) && <span className="rounded-full bg-ink px-2.5 py-0.5 font-semibold text-primary">Tu turno</span>}
              </div>
              <p className="truncate font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {p.role === "cliente" ? "Proveedor" : "Cliente"} <span className="font-mono">{short(p.counterparty)}</span> · {p.days} días · {p.createdAt}
              </p>
            </div>
            <p className="shrink-0 font-display text-lg font-bold">{p.amount} <span className="text-xs">MON</span></p>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          </motion.div>
        ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Stat({ v, l, highlight, className = "" }: { v: string | number; l: string; highlight?: boolean; className?: string }) {
  return (
    <div className={`card ${highlight ? "ring-2 ring-primary" : ""} ${className}`}>
      <p className="text-2xl font-bold">{v}</p>
      <p className="text-xs text-muted-foreground">{l}</p>
    </div>
  );
}
