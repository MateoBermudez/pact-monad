"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { usePact } from "@/lib/client/pact-context";
import { useHydrated } from "@/lib/client/use-hydrated";
import { summarizePacts } from "@/lib/shared/ui-pact";
import { IllustrationHero } from "@/components/Illustrations";

const STEPS = [
  {
    icon: FileText,
    t: "Describe",
    d: "Escribe lo que necesitas en tus palabras.",
  },
  {
    icon: Sparkles,
    t: "La IA estructura",
    d: "Monto, plazo y entregables, listos para revisar.",
  },
  {
    icon: Lock,
    t: "Bloquea MON",
    d: "El pago queda en un contrato, no en manos de nadie.",
  },
  {
    icon: CheckCircle2,
    t: "Aprueba y libera",
    d: "El proveedor cobra cuando apruebas la entrega.",
  },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const GENERIC_STATS: [string, string][] = [
  ["3", "pasos para crear"],
  ["MON", "de Monad Testnet"],
  ["Tu firma", "para confirmar"],
];

export default function Landing() {
  const { signedIn: sessionActive, pacts } = usePact();
  const hydrated = useHydrated();
  const signedIn = hydrated && sessionActive;
  const summary = summarizePacts(pacts);
  const stats: [string, string][] = signedIn
    ? [
        [String(summary.inProgress), "acuerdos en curso"],
        [String(summary.needsAction), "requieren tu acción"],
        [`${summary.lockedMon} MON`, "bloqueados en escrow"],
        [`${summary.earnedMon} MON`, "cobrados como proveedor"],
      ]
    : GENERIC_STATS;
  return (
    <div className="space-y-14 pt-2">
      {/* Onboarding-style hero: lime panel, big display headline, round arrow CTA */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-primary px-6 pb-6 pt-8 sm:px-10 sm:pt-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_1fr]">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="order-2 space-y-5 md:order-1"
          >
            <motion.h1
              variants={rise}
              className="font-display text-[2.6rem] font-bold leading-[1.02] text-primary-foreground sm:text-6xl"
            >
              Paga solo cuando el trabajo{" "}
              <span className="inline-flex translate-y-1 items-center rounded-full bg-ink px-4 py-1 align-middle text-primary sm:px-5">
                <ArrowRight
                  className="h-7 w-7 sm:h-9 sm:w-9"
                  strokeWidth={2.6}
                />
              </span>{" "}
              está hecho.
            </motion.h1>
            <motion.p
              variants={rise}
              className="max-w-sm text-sm text-primary-foreground/75 sm:text-base"
            >
              Un acuerdo con dinero bloqueado en escrow sobre Monad. Sin
              intermediarios: el pago se libera cuando se cumple lo acordado.
            </motion.p>
            <motion.div
              variants={rise}
              className="flex items-center justify-between gap-4 pt-2 sm:justify-start sm:gap-8"
            >
              <Link
                href={signedIn ? "/dashboard" : "/iniciar-sesion"}
                className="text-sm font-semibold text-primary-foreground/70 underline-offset-4 hover:text-primary-foreground hover:underline"
              >
                {signedIn ? "Ver mis acuerdos" : "Iniciar sesión"}
              </Link>
              <Link
                href={signedIn ? "/crear" : "/registro"}
                aria-label={signedIn ? "Crear un acuerdo" : "Crear una cuenta"}
                className="group flex items-center gap-2.5 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-sm font-bold text-ink-foreground transition-transform active:scale-95"
              >
                {signedIn ? "Empezar" : "Registrarme"}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-ink transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.6} />
                </span>
              </Link>
            </motion.div>
          </motion.div>
          <motion.div
            className="order-1 mx-auto w-full max-w-[420px] md:order-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            <IllustrationHero />
          </motion.div>
        </div>
      </section>

      <section
        className={signedIn ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-4 sm:grid-cols-3"}
      >
        {stats.map(([v, l], index) => (
          <motion.div
            key={l}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.06 }}
            className="card border-black shadow-[0_4px_0_#000] text-center"
          >
            <p className="font-display text-3xl font-bold">{v}</p>
            <p className="text-sm text-muted-foreground">{l}</p>
          </motion.div>
        ))}
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold">Cómo funciona</h2>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STEPS.map((s, i) => (
            <motion.div
              variants={rise}
              whileHover={{ y: -3 }}
              key={s.t}
              className="card space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink">
                  <s.icon className="h-5 w-5 text-primary" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <p className="font-semibold">{s.t}</p>
              <p className="text-sm text-muted-foreground">{s.d}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="circuit flex flex-col items-start gap-6 rounded-[2rem] bg-ink p-8 text-ink-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-primary">
            <ShieldCheck className="h-4 w-4" />{" "}
            {signedIn ? "Tu wallet firma cada pago" : "Empieza en segundos"}
          </p>
          <p className="font-display text-2xl font-bold">
            {signedIn ? "Tú decides cuándo se libera." : "Sin contraseñas. Sin formularios largos."}
          </p>
          <p className="text-sm text-ink-foreground/60">
            {signedIn
              ? "Revisa tus acuerdos y firma desde tu wallet."
              : "Entra con Google o GitHub y conecta tu wallet cuando necesites firmar."}
          </p>
        </div>
        {signedIn ? (
          <Link
            href="/dashboard"
            className="press flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Wallet className="h-4 w-4" /> Ir al dashboard
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/iniciar-sesion"
              className="press rounded-full border border-ink-foreground/30 px-5 py-3 text-sm font-semibold text-ink-foreground"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="press flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Wallet className="h-4 w-4" /> Registrarme
            </Link>
          </div>
        )}
      </motion.section>
    </div>
  );
}
