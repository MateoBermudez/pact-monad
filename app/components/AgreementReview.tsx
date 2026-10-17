"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Database,
  FileText,
  FlaskConical,
  Info,
  ShieldCheck,
  UserRound,
  Wand2,
} from "lucide-react";
import { IllustrationContractIdea } from "./Illustrations";
import { providerError, reviewSchema } from "@/lib/shared/agreement-review";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  amount: string;
  days: string;
  provider: string;
  client?: string;
  manual: boolean;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onAmount: (v: string) => void;
  onDays: (v: string) => void;
  onProvider: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
};
const input =
  "w-full rounded-lg border border-ink/50 bg-card px-4 py-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-primary/50";
function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </label>
      {children}
    </div>
  );
}

export function AgreementReview(p: Props) {
  const walletError = providerError(p.provider, p.client);
  const amountOk = reviewSchema.shape.amount.safeParse(p.amount).success;
  const daysOk = reviewSchema.shape.days.safeParse(p.days).success;
  const valid =
    reviewSchema.safeParse({ ...p, description: p.description }).success &&
    !walletError;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.65fr_1fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) p.onNext();
        }}
        className="space-y-5 rounded-2xl border-2 border-ink bg-card p-5 shadow-[0_3px_0_var(--ink)] sm:p-7"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold">
            Detalles del acuerdo
          </h2>
          {!p.manual && (
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/25 px-4 py-2 text-xs">
              <Wand2 className="h-4 w-4" />
              Propuesta de IA · Editable
            </span>
          )}
        </div>
        <Field label="Título del acuerdo" id="review-title">
          <input
            id="review-title"
            className={input}
            value={p.title}
            onChange={(e) => p.onTitle(e.target.value)}
            placeholder="Nombre corto del trabajo"
            minLength={3}
            maxLength={120}
            required
          />
        </Field>
        <Field label="Descripción y entregables" id="review-description">
          <textarea
            id="review-description"
            className={`${input} min-h-28 resize-y`}
            rows={3}
            value={p.description}
            onChange={(e) => p.onDescription(e.target.value)}
            placeholder="Describe el trabajo, los entregables y sus condiciones"
            minLength={10}
            maxLength={5000}
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Monto en MON" id="review-amount">
            <div className="relative">
              <input
                id="review-amount"
                className={`${input} pr-20`}
                inputMode="decimal"
                value={p.amount}
                onChange={(e) => p.onAmount(e.target.value)}
                placeholder="Pendiente"
                required
                aria-invalid={!!p.amount && !amountOk}
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex w-18 items-center justify-center rounded-r-lg border-l border-ink/10 bg-ink/5 text-sm text-muted-foreground">
                MON
              </span>
            </div>
            {!!p.amount && !amountOk && (
              <span className="block text-xs text-destructive">
                Mayor que cero, hasta 5.000.000 MON y máximo 6 decimales.
              </span>
            )}
          </Field>
          <Field label="Plazo de entrega" id="review-days">
            <div className="relative">
              <input
                id="review-days"
                className={`${input} pr-20`}
                inputMode="numeric"
                value={p.days}
                onChange={(e) => p.onDays(e.target.value)}
                placeholder="Pendiente"
                required
                aria-invalid={!!p.days && !daysOk}
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex w-18 items-center justify-center rounded-r-lg border-l border-ink/10 bg-ink/5 text-sm text-muted-foreground">
                días
              </span>
            </div>
            {!!p.days && !daysOk && (
              <span className="block text-xs text-destructive">
                Introduce un número entero entre 1 y 365 días.
              </span>
            )}
          </Field>
        </div>
        <div className="space-y-2">
          <Field label="Wallet del proveedor" id="review-provider">
            <input
              id="review-provider"
              className={input}
              value={p.provider}
              onChange={(e) => p.onProvider(e.target.value)}
              placeholder="Pega la dirección 0x…"
              autoComplete="off"
              spellCheck={false}
              required
              aria-describedby="provider-help provider-error"
              aria-invalid={!!p.provider && !!walletError}
            />
          </Field>
          <p id="provider-help" className="text-xs text-muted-foreground">
            La persona que realizará el trabajo y recibirá el pago.
          </p>
          <p
            id="provider-error"
            aria-live="polite"
            className="text-xs text-destructive"
          >
            {p.provider && walletError ? walletError : null}
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-ink/3 px-4 py-3 text-xs text-muted-foreground">
            <Info className="h-5 w-5 shrink-0 text-ink" />
            Revisa que la dirección sea correcta antes de continuar.
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-ink/15 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <button
            type="button"
            onClick={p.onBack}
            className="btn-secondary min-h-11 self-start border-2 border-ink shadow-[0_2px_0_var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="space-y-2 sm:text-right">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {walletError ??
                (!valid
                  ? "Completa los campos requeridos para continuar."
                  : "Todo listo para revisar y continuar.")}
            </p>
            <button
              type="submit"
              disabled={!valid}
              className="group flex min-h-12 w-full items-center justify-between gap-5 rounded-full bg-ink py-1.5 pl-6 pr-1.5 text-sm font-bold text-ink-foreground disabled:cursor-not-allowed disabled:bg-ink/30 disabled:text-card sm:w-auto"
            >
              Revisar y continuar
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-ink group-disabled:bg-transparent group-disabled:text-card">
                <ArrowRight className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>
      </form>
      <div className="space-y-4">
        <aside
          aria-label="Resumen del acuerdo"
          className="relative overflow-hidden rounded-2xl border-2 border-ink bg-primary p-6 text-ink shadow-[0_2px_0_var(--ink)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative">
            <h2 className="font-display text-2xl font-bold">
              Resumen del acuerdo
            </h2>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-5 top-9 w-32 opacity-90"
            >
              <IllustrationContractIdea />
            </div>
            <dl className="mt-4 divide-y divide-ink/25">
              {[
                {
                  icon: FileText,
                  label: "Trabajo",
                  value: p.title.trim() || "Pendiente de completar",
                  small: true,
                },
                {
                  icon: Database,
                  label: "Monto a bloquear",
                  value: amountOk
                    ? `${p.amount.replace(",", ".")} MON`
                    : "Pendiente",
                  small: false,
                },
                {
                  icon: CalendarDays,
                  label: "Plazo",
                  value: daysOk
                    ? `${Number(p.days)} ${Number(p.days) === 1 ? "día" : "días"}`
                    : "Pendiente",
                  small: false,
                },
                {
                  icon: UserRound,
                  label: "Proveedor",
                  value: !walletError
                    ? `${p.provider.trim().slice(0, 6)}…${p.provider.trim().slice(-4)}`
                    : "Pendiente de completar",
                  small: true,
                },
              ].map(({ icon: Icon, label, value, small }, i) => (
                <div
                  key={label}
                  className={`flex items-center gap-4 py-4 ${i < 2 ? "pr-17" : ""}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card">
                    <Icon className="h-6 w-6" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-sm font-bold">{label}</dt>
                    <dd
                      className={`mt-1 break-words ${small ? "text-sm" : "font-display text-2xl font-bold"}`}
                    >
                      {value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-2 flex items-center gap-2 border-t border-ink pt-3 text-xs">
              <FlaskConical className="h-4 w-4" />
              MON de prueba · Monad Testnet
            </p>
          </div>
        </aside>
        <aside className="flex items-center gap-5 rounded-2xl bg-ink p-6 text-ink-foreground">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
            <ShieldCheck className="h-8 w-8" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">
              Tú apruebas el pago
            </h3>
            <p className="mt-1 text-sm text-ink-foreground/85">
              La IA propone las condiciones.
              <br />
              Tú las revisas y confirmas.
            </p>
          </div>
        </aside>
        <p className="text-xs text-muted-foreground">
          Todavía no se bloquearán fondos.
        </p>
      </div>
    </div>
  );
}
