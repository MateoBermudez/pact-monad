"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Database,
  Info,
  PenLine,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { IllustrationEscrowLock } from "@/components/Illustrations";

type Props = {
  title: string;
  description: string;
  rules: string[];
  keywords: string[];
  amount: string;
  days: string;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onPublish: () => void;
};

const WHAT_HAPPENS = [
  "Publicamos tu solicitud y avisamos a quienes tienen esas habilidades",
  "Recibes propuestas y tu IA las evalúa según tu configuración",
  "Eliges a la persona y, solo entonces, firmas para bloquear los fondos",
];

export function ListingPublish(p: Props) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.38fr_1fr]">
      <section className="space-y-5 rounded-[1.75rem] border-2 border-ink bg-card p-6 shadow-[0_3px_0_var(--ink)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{p.title}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/35 px-3 py-1 text-xs font-semibold text-ink">
              <Sparkles className="h-3.5 w-3.5" />
              Listo para publicar
            </span>
          </div>
          <button
            type="button"
            disabled={p.busy}
            onClick={p.onEdit}
            className="press inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground disabled:opacity-50 sm:text-sm"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className="underline decoration-foreground/60 underline-offset-4">Editar</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Trabajo y entregables</p>
          <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded-xl border border-ink/15 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {p.description}
          </div>
        </div>

        {p.keywords.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Palabras clave</p>
            <ul className="flex flex-wrap gap-2">
              {p.keywords.map((keyword) => (
                <li key={keyword} className="rounded-full border border-ink/30 bg-primary/25 px-3 py-1 text-xs font-medium">
                  {keyword}
                </li>
              ))}
            </ul>
          </div>
        )}

        <hr className="border-ink/10" />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Criterios para revisar la entrega</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {p.rules.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Presupuesto</p>
            <div className="rounded-xl border border-ink/15 bg-muted/40 px-4 py-2.5 text-base font-semibold text-foreground">
              {p.amount || "0"} MON
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Plazo de entrega</p>
            <div className="rounded-xl border border-ink/15 bg-muted/40 px-4 py-2.5 text-base font-semibold text-foreground">
              {p.days || "0"} {Number(p.days) === 1 ? "día" : "días"}
            </div>
          </div>
        </div>

        <hr className="border-ink/10" />

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground">Qué ocurre al publicar</p>
          <ol className="space-y-2">
            {WHAT_HAPPENS.map((item, idx) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-ink">
                  {idx + 1}
                </span>
                <div className="flex-1 rounded-lg border border-ink/10 bg-muted/40 px-3.5 py-2 text-xs font-medium text-foreground/85">
                  {item}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2.5 rounded-lg border border-ink/10 bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-ink" />
            <span>La wallet de quien haga el trabajo se toma de su perfil cuando lo eliges.</span>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            disabled={p.busy}
            onClick={p.onEdit}
            className="press inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-5 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver y editar
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-5">
        <aside className="relative overflow-hidden rounded-[1.75rem] border-2 border-ink bg-primary p-6 text-ink shadow-[0_3px_0_var(--ink)] sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative z-10 space-y-5">
            <div className="relative min-h-[126px] pr-36 sm:pr-44">
              <p className="font-display text-lg font-bold text-ink sm:text-xl">Presupuesto de la solicitud</p>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
                {p.amount || "0"} MON
              </p>
              <p className="mt-1.5 text-xs font-medium text-ink/80 sm:text-sm">Monad Testnet · MON de prueba</p>
              <div className="pointer-events-none absolute -right-2 -top-3 w-36 sm:w-44">
                <IllustrationEscrowLock />
              </div>
            </div>

            <div className="space-y-3 border-y border-ink/20 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3 text-xs font-semibold text-ink sm:text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                    <Database className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  Fondos bloqueados ahora
                </span>
                <span className="font-display text-base font-extrabold text-ink sm:text-lg">0 MON</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3 text-xs font-semibold text-ink sm:text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                    <BellRing className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  Aviso a prestadores
                </span>
                <span className="text-xs font-semibold text-ink sm:text-sm">Al publicar</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3 text-xs font-semibold text-ink sm:text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                    <Users className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  Wallet del proveedor
                </span>
                <span className="text-xs font-semibold text-ink sm:text-sm">Cuando lo eliges</span>
              </div>
            </div>

            {p.error && (
              <div role="alert" className="space-y-2 rounded-2xl border-2 border-ink bg-card p-3.5 text-xs text-foreground">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="font-medium">{p.error}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                disabled={p.busy}
                onClick={p.onPublish}
                className="group press flex w-full items-center justify-between gap-4 rounded-full bg-ink py-2.5 pl-7 pr-2.5 text-sm font-bold text-ink-foreground shadow-[0_4px_0_oklch(0.19_0.01_120/0.25)] transition-all enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none sm:text-base"
              >
                <span className="flex-1 text-center">{p.busy ? "Publicando…" : "Publicar oportunidad"}</span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-ink transition-transform duration-300 group-enabled:group-hover:translate-x-0.5">
                  <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                </span>
              </button>
              <p className="text-center text-xs font-medium text-ink/75">No se abre MetaMask ni se bloquean fondos.</p>
            </div>
          </div>
        </aside>

        <aside className="flex items-center gap-4 rounded-[1.75rem] border-2 border-ink bg-ink p-5 text-ink-foreground sm:p-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
            <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <div className="space-y-0.5">
            <h3 className="font-display text-base font-bold text-ink-foreground sm:text-lg">Tú eliges con quién trabajar</h3>
            <p className="text-xs leading-relaxed text-ink-foreground/80 sm:text-sm">
              La IA orienta. Los fondos solo se mueven con tu firma.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
