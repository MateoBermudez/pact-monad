"use client";

import { AgreementReview } from "@/components/AgreementReview";
import {
  providerError,
  reviewSchema,
  structureAgreement,
} from "@/lib/client/agreement-review";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Eye,
  FileText,
  Info,
  Paintbrush,
  PenLine,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { short, usePact } from "@/lib/client/pact-context";
import {
  createAndLockAgreement,
  isUserRejectedError,
} from "@/lib/client/escrow-wallet";
import {
  IllustrationContractIdea,
  IllustrationEscrowLock,
} from "@/components/Illustrations";

type TxState = "idle" | "signing" | "creating";

const EXAMPLE =
  "Necesito un logo para una cafetería, en PNG y SVG, por 10 MON, en 3 días.";
const THINKING = [
  "Leyendo tu texto",
  "Detectando monto y plazo",
  "Definiendo los entregables",
  "Armando el acuerdo",
];

const QUICK_EXAMPLES: { label: string; icon: LucideIcon; prompt: string }[] = [
  {
    label: "Diseño de logo",
    icon: Paintbrush,
    prompt:
      "Necesito un logo para una cafetería, en PNG y SVG, por 10 MON, en 3 días.",
  },
  {
    label: "Página web",
    icon: Code2,
    prompt:
      "Necesito una página web landing responsive de 4 secciones con formulario, por 45 MON, en 14 días.",
  },
  {
    label: "Traducción",
    icon: FileText,
    prompt:
      "Necesito la traducción de un documento de 20 páginas al inglés en formato PDF, por 20 MON, en 5 días.",
  },
];

function deriveTitle(description: string): string {
  const cleaned = description
    .replace(/^\s*(dise[ñn]o de|necesito|quiero|busco)\s+/i, "")
    .replace(/^\s*(un|una|el|la)\s+/i, "")
    .split(/[,.]/)[0]
    ?.trim();
  if (!cleaned) return "Nuevo acuerdo";
  return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 48);
}

const STEPS = ["Describe", "Revisa", "Confirma"] as const;

/** 3-step horizontal progress indicator in the header: 1 Describe — 2 Revisa — 3 Confirma */
function Stepper({
  step,
  onGo,
  disabled,
}: {
  step: number;
  onGo: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav aria-label="Progreso del acuerdo" className="shrink-0">
      <ol className="flex items-start">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex items-start">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={!done || disabled}
                  onClick={() => onGo(i)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Paso ${i + 1}: ${label}`}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold transition-colors duration-300 ${
                    done
                      ? "cursor-pointer border-2 border-ink bg-primary/25 text-ink hover:bg-primary/40 disabled:cursor-default"
                      : current
                        ? "cursor-default border-2 border-ink bg-primary text-ink"
                        : "cursor-default border border-ink/25 bg-ink/8 text-foreground/75"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={2.8} />
                  ) : (
                    i + 1
                  )}
                </button>
                <span
                  className={`text-sm transition-colors ${
                    current || done
                      ? "font-bold text-foreground"
                      : "font-medium text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className={`mx-2.5 mt-[21px] h-[1.5px] w-12 transition-colors sm:mx-3 sm:w-20 ${
                    i < step ? "bg-ink/35" : "bg-ink/20"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ParticipantBox({
  roleLabel,
  address,
  placeholder,
}: {
  roleLabel: string;
  address: string;
  placeholder?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasAddress = address.trim().length > 0;

  const copyAddress = async () => {
    if (!hasAddress) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(`Dirección copiada: ${short(address)}`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar la dirección.");
    }
  };

  return (
    <div className="rounded-xl border border-ink/15 bg-muted/35 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/35 text-ink">
            <User className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">{roleLabel}</p>
            {hasAddress ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                title={address}
                className="block truncate font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                {short(address)}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {placeholder ?? "Sin conectar"}
              </p>
            )}
          </div>
        </div>

        {hasAddress && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={`Ver dirección completa de ${roleLabel}`}
              title="Consultar dirección completa"
              className="press rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void copyAddress()}
              aria-label={`Copiar dirección de ${roleLabel}`}
              title="Copiar dirección completa"
              className="press rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.8} />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {hasAddress && expanded && (
        <p className="mt-2 break-all rounded-lg bg-card px-2.5 py-1.5 font-mono text-[11px] text-foreground ring-1 ring-ink/10">
          {address}
        </p>
      )}
    </div>
  );
}

export default function Index({
  initialProvider = "",
}: { initialProvider?: string } = {}) {
  const {
    address,
    balance,
    connected,
    wrongNetwork,
    connectWallet,
    switchNetwork,
    refresh,
    signIn,
  } = usePact();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [listingId, setListingId] = useState<string | undefined>();
  const [prepared, setPrepared] = useState(false);
  const [rules, setRules] = useState<string[]>([]);
  const revise = (set: (value: string) => void) => (value: string) => {
    if (prepared) {
      setListingId(undefined);
      setPrepared(false);
    }
    set(value);
  };
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkIdx, setThinkIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [title, setTitle] = useState("");
  const [failureMessage, setFailureMessage] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [provider, setProvider] = useState(initialProvider);
  const [confirmedTerms, setConfirmedTerms] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    const onReset = () => {
      setDir(-1);
      setStep(0);
      setTxState("idle");
      setTxError(null);
    };
    window.addEventListener("pact:reset-crear", onReset);
    return () => window.removeEventListener("pact:reset-crear", onReset);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(
      () => setThinkIdx((i) => Math.min(i + 1, THINKING.length - 1)),
      420,
    );
    return () => clearInterval(t);
  }, [loading]);

  const desc = manualMode ? original : aiDesc;
  const setDesc = (v: string) => (manualMode ? setOriginal(v) : setAiDesc(v));

  const go = (n: number) => {
    if (txState !== "idle") return;
    setDir(n > step ? 1 : -1);
    if (n === 2) {
      // Reset confirmation checkbox and error whenever entering step 3
      setConfirmedTerms(false);
      setTxError(null);
    }
    setStep(n);
  };

  const hasText = prompt.trim().length > 0;

  const completeManually = () => {
    if (loading) return;
    setManualMode(true);
    setRules([]);
    setPrepared(false);
    setListingId(undefined);
    setFailed(false);
    setOriginal("");
    setAiDesc("");
    setTitle("");
    setAmount("");
    setDays("");
    setProvider(initialProvider);
    go(1);
  };

  const structure = async () => {
    const text = prompt.trim();
    if (loading || !text) return;
    setThinkIdx(0);
    setLoading(true);
    setFailed(false);
    setManualMode(false);
    setOriginal(text);

    try {
      const result = await structureAgreement(text);
      setPrepared(false);
      setListingId(result.listing.id);
      setRules(result.listing.rules?.map((rule) => rule.criterion) ?? []);
      setAiDesc(result.listing.description ?? "");
      setTitle(result.listing.title);
      setAmount(result.listing.budgetMon ?? "");
      setDays(
        result.listing.deadlineDays === null
          ? ""
          : String(result.listing.deadlineDays),
      );
      setProvider(initialProvider);
      setManualMode(result.source !== "ai");
      if (result.source !== "ai") setOriginal(result.listing.description ?? "");
      setLoading(false);
      go(1);
    } catch (error) {
      setFailureMessage(
        error instanceof Error
          ? error.message
          : "No pudimos estructurar el acuerdo.",
      );
      setFailed(true);
      setLoading(false);
    }
  };

  const numAmount = Number(amount.replace(",", ".")) || 0;
  const numDays = Number(days) || 0;
  const providerTrimmed = provider.trim();
  const walletError = providerError(provider, connected ? address : undefined);
  const detailsOk =
    reviewSchema.safeParse({ title, description: desc, amount, days, provider })
      .success && !walletError;
  const hasEnoughBalance = !connected || balance >= numAmount;
  const txBusy = txState !== "idle";

  const handleConfirmAction = async () => {
    if (txBusy) return;
    setTxError(null);

    // 1. Sin wallet conectada -> Conectar MetaMask
    if (!connected) {
      try {
        const client = await connectWallet();
        const error = providerError(provider, client);
        if (error) {
          go(1);
          toast.error(error);
        }
      } catch (err) {
        if (!isUserRejectedError(err)) {
          setTxError(
            err instanceof Error
              ? err.message
              : "No se pudo conectar con MetaMask.",
          );
        }
      }
      return;
    }

    // 2. En otra red -> Cambiar a Monad Testnet
    if (wrongNetwork) {
      try {
        await switchNetwork();
      } catch (err) {
        if (!isUserRejectedError(err)) {
          setTxError(
            err instanceof Error
              ? err.message
              : "No se pudo cambiar a Monad Testnet.",
          );
        }
      }
      return;
    }

    // 3. Con datos válidos, saldo suficiente y casilla marcada -> Crear y bloquear X MON
    if (!detailsOk || !hasEnoughBalance || !confirmedTerms) return;

    setTxState("signing");
    try {
      await signIn();
      const d = desc.trim() || "Nuevo acuerdo";
      const transaction = await createAndLockAgreement({
        title,
        listingId,
        onPrepared: (id) => {
          setListingId(id);
          setPrepared(true);
        },
        clientAddress: address,
        providerAddress: providerTrimmed,
        description: d,
        amountMon: numAmount,
        days: numDays,
        onTxSent: () => {
          setTxState("creating");
        },
      });

      const agreements = await refresh();
      const created = agreements.find(
        (item) => item.createTx === transaction.txHash,
      );
      toast.success("Acuerdo confirmado en Monad", {
        description:
          "El backend actualizara el acuerdo al indexar la transaccion.",
      });
      router.push(created ? `/pact/${created.id}` : "/dashboard");
    } catch (err) {
      setTxState("idle");
      // Si el usuario rechaza la firma, permanece aquí sin perder los datos.
      if (isUserRejectedError(err)) {
        return;
      }
      // Si falla la transacción, mostrar el error y permitir reintentar.
      setTxError(
        err instanceof Error
          ? err.message
          : "La transacción falló en la red. Tus datos siguen guardados; puedes reintentar.",
      );
    }
  };

  const confirmButtonLabel = () => {
    if (txState === "signing") return "Esperando tu firma…";
    if (txState === "creating") return "Creando acuerdo…";
    if (!connected) return "Conectar MetaMask";
    if (wrongNetwork) return "Cambiar a Monad Testnet";
    return `Crear y bloquear ${amount || "0"} MON`;
  };

  const confirmButtonDisabled =
    txBusy ||
    (connected &&
      !wrongNetwork &&
      (!detailsOk || !hasEnoughBalance || !confirmedTerms));

  const agreementTitle = title.trim() || deriveTitle(desc);

  return (
    <div className="space-y-6 pb-28">
      {/* Top back link */}
      <div>
        {step === 0 ? (
          <Link
            href="/"
            className="press inline-flex items-center gap-2 text-sm font-medium text-foreground/85 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="underline decoration-foreground/60 underline-offset-4">
              Volver al inicio
            </span>
          </Link>
        ) : step === 1 ? (
          <button
            type="button"
            onClick={() => go(0)}
            className="press inline-flex items-center gap-2 text-sm font-medium text-foreground/85 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="underline decoration-foreground/60 underline-offset-4">
              Volver a la descripción
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled={txBusy}
            onClick={() => go(1)}
            className="press inline-flex items-center gap-2 text-sm font-medium text-foreground/85 hover:text-foreground disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="underline decoration-foreground/60 underline-offset-4">
              Volver a las condiciones
            </span>
          </button>
        )}
      </div>

      {/* Header + 3-step Stepper */}
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div className="space-y-1.5">
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {step === 2
              ? "Confirma tu acuerdo."
              : step === 1
                ? "Revisa las condiciones."
                : "Crea tu próximo acuerdo."}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {step === 2
              ? "Revisa el resumen y bloquea los fondos para comenzar."
              : step === 1
                ? "Ajusta los detalles antes de crear tu acuerdo."
                : "Cuéntanos qué necesitas. La IA te ayuda a organizarlo."}
          </p>
        </div>
        <Stepper step={step} onGo={go} disabled={txBusy} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 18 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 * dir }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* PASO 01 · Describe */}
          {step === 0 && (
            <div className="grid items-stretch gap-6 lg:grid-cols-[1.38fr_1fr]">
              {/* Left main card */}
              <section className="flex flex-col justify-between gap-6 rounded-[1.75rem] border-2 border-ink bg-card p-6 shadow-[0_3px_0_var(--ink)] sm:p-8">
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      PASO 01
                    </p>
                    <h2 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-4xl">
                      ¿Qué trabajo necesitas?
                    </h2>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      Incluye el entregable, el presupuesto en MON y el plazo.
                    </p>
                  </div>

                  {/* Textarea with notched label */}
                  <div className="space-y-2">
                    <div className="relative rounded-2xl border border-ink/25 bg-card transition-colors focus-within:border-ink focus-within:ring-2 focus-within:ring-primary/40">
                      <label
                        htmlFor="agreement-prompt"
                        className="pointer-events-none absolute -top-2.5 left-3.5 bg-card px-1.5 text-xs font-medium text-muted-foreground"
                      >
                        Ejemplo de solicitud
                      </label>
                      <textarea
                        id="agreement-prompt"
                        rows={5}
                        value={prompt}
                        disabled={loading}
                        onChange={(e) => {
                          setPrompt(e.target.value);
                          if (failed) setFailed(false);
                        }}
                        placeholder={EXAMPLE}
                        className="w-full resize-y rounded-2xl bg-transparent px-4 pb-3 pt-4 text-base text-foreground placeholder:text-muted-foreground/80 outline-none disabled:opacity-60"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Podrás editar todos los detalles en el siguiente paso.
                    </p>
                  </div>

                  {/* Quick examples */}
                  <div className="space-y-2.5">
                    <p className="text-sm font-semibold text-foreground">
                      Ejemplos rápidos
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {QUICK_EXAMPLES.map((ex) => (
                        <button
                          key={ex.label}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setPrompt(ex.prompt);
                            if (failed) setFailed(false);
                          }}
                          className="group press flex items-center justify-between gap-2 rounded-2xl border-[1.5px] border-ink bg-card px-3 py-2.5 text-left transition-colors hover:bg-primary/20 disabled:pointer-events-none disabled:opacity-60"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/35 text-ink">
                              <ex.icon className="h-4 w-4" strokeWidth={2.2} />
                            </span>
                            <span className="truncate text-xs font-bold text-foreground sm:text-[13px]">
                              {ex.label}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-foreground/75 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Loading thinking state */}
                <AnimatePresence>
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 rounded-2xl bg-ink p-4 text-ink-foreground">
                        <ul className="space-y-1.5 text-sm">
                          {THINKING.map((t, i) => (
                            <li
                              key={t}
                              className={`flex items-center gap-2 transition-opacity ${
                                i <= thinkIdx ? "opacity-100" : "opacity-30"
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full ${
                                  i < thinkIdx
                                    ? "bg-primary text-ink"
                                    : "border border-white/30"
                                }`}
                              >
                                {i < thinkIdx && (
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                )}
                              </span>
                              {t}
                            </li>
                          ))}
                        </ul>
                        <div className="space-y-2">
                          <div className="shimmer h-3 w-11/12 rounded-full" />
                          <div className="shimmer h-3 w-8/12 rounded-full" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error fallback when AI fails: preserves text and lets user Retry or Complete manually */}
                <AnimatePresence>
                  {failed && !loading && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      role="alert"
                      className="space-y-3 rounded-2xl border-2 border-ink bg-warning/15 p-4 text-sm text-foreground"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <p className="font-medium">
                          {failureMessage ||
                            "No pudimos organizar el acuerdo con la IA. Conservamos tu texto para que puedas reintentar o continuar manualmente."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => void structure()}
                          className="press inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-bold text-primary"
                        >
                          Reintentar
                        </button>
                        <button
                          type="button"
                          onClick={completeManually}
                          className="press inline-flex items-center gap-1.5 rounded-full border border-ink bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-primary/20"
                        >
                          Completar manualmente{" "}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom actions bar */}
                <div className="flex flex-col-reverse gap-4 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={completeManually}
                    className="press inline-flex items-center gap-2 self-start text-sm font-medium text-foreground/85 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 sm:self-auto"
                  >
                    <span className="underline decoration-foreground/60 underline-offset-4">
                      Completar manualmente
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void structure()}
                    disabled={loading || !hasText}
                    className="group press inline-flex items-center justify-between gap-5 rounded-full bg-ink py-2 pl-7 pr-2 text-sm font-bold text-ink-foreground shadow-[0_4px_0_oklch(0.19_0.01_120/0.25)] transition-all enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:justify-center sm:text-base"
                  >
                    <span>
                      {loading
                        ? "Organizando tu acuerdo…"
                        : "Estructurar con IA"}
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-ink transition-transform duration-300 group-enabled:group-hover:translate-x-0.5">
                      <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  </button>
                </div>
              </section>

              {/* Right sidebar cards */}
              <div className="flex flex-col gap-5">
                {/* Top lime info card */}
                <aside className="relative flex-1 overflow-hidden rounded-[1.75rem] border-2 border-ink bg-primary p-6 text-ink sm:p-7">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                      backgroundImage:
                        "linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)",
                      backgroundSize: "32px 32px",
                    }}
                  />

                  <div className="relative z-10 flex flex-col justify-between gap-5">
                    <div className="relative min-h-[150px] pr-36 sm:pr-44">
                      <h3 className="font-display text-2xl font-bold leading-[1.12] text-ink sm:text-[1.75rem]">
                        De una idea a un acuerdo claro.
                      </h3>
                      <div className="pointer-events-none absolute -right-2 -top-3 w-40 sm:w-48">
                        <IllustrationContractIdea />
                      </div>
                    </div>

                    <ul className="relative z-10 space-y-4">
                      <li className="flex items-center gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                          <FileText className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <div>
                          <p className="font-display text-sm font-bold leading-snug text-ink sm:text-base">
                            Define qué se entrega
                          </p>
                          <p className="text-xs text-ink/75 sm:text-sm">
                            Describe tu idea con claridad.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-center gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                          <Database className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <div>
                          <p className="font-display text-sm font-bold leading-snug text-ink sm:text-base">
                            Establece monto y plazo
                          </p>
                          <p className="text-xs text-ink/75 sm:text-sm">
                            Ponte de acuerdo en los términos.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-center gap-3.5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                          <Check className="h-5 w-5" strokeWidth={2.8} />
                        </span>
                        <div>
                          <p className="font-display text-sm font-bold leading-snug text-ink sm:text-base">
                            Revisa antes de firmar
                          </p>
                          <p className="text-xs text-ink/75 sm:text-sm">
                            La IA organiza los detalles del acuerdo.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </aside>

                {/* Bottom dark control card */}
                <aside className="flex items-center gap-4 rounded-[1.75rem] border-2 border-ink bg-ink p-5 text-ink-foreground sm:p-6">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-7 w-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="5" y="11" width="14" height="10" rx="2.5" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      <circle
                        cx="12"
                        cy="16"
                        r="1.2"
                        fill="currentColor"
                        stroke="none"
                      />
                    </svg>
                  </span>
                  <div className="space-y-0.5">
                    <h3 className="font-display text-base font-bold text-ink-foreground sm:text-lg">
                      Tú tienes el control
                    </h3>
                    <p className="text-xs leading-relaxed text-ink-foreground/80 sm:text-sm">
                      En este paso no se bloquean fondos.
                      <br />
                      Para usar la IA necesitas iniciar sesión.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {/* PASO 02 · Revisa */}
          {step === 1 && (
            <AgreementReview
              title={title}
              description={desc}
              amount={amount}
              days={days}
              provider={provider}
              client={connected ? address : ""}
              manual={manualMode}
              onTitle={revise(setTitle)}
              onDescription={(value) => {
                setRules([]);
                revise(setDesc)(value);
              }}
              onAmount={(value) => {
                setRules([]);
                revise(setAmount)(value);
              }}
              onDays={(value) => {
                setRules([]);
                revise(setDays)(value);
              }}
              onProvider={revise(setProvider)}
              onBack={() => go(0)}
              onNext={() => {
                if (detailsOk) go(2);
              }}
            />
          )}

          {/* PASO 03 · Confirma */}
          {step === 2 && (
            <div className="grid items-start gap-6 lg:grid-cols-[1.38fr_1fr]">
              {/* Left Summary Card */}
              <section className="space-y-5 rounded-[1.75rem] border-2 border-ink bg-card p-6 shadow-[0_3px_0_var(--ink)] sm:p-8">
                {/* Title + Listo para crear badge + Editar link */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                      {agreementTitle}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/35 px-3 py-1 text-xs font-semibold text-ink">
                      <Sparkles className="h-3.5 w-3.5" />
                      Listo para crear
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={txBusy}
                    onClick={() => go(1)}
                    className="press inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground disabled:opacity-50 sm:text-sm"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    <span className="underline decoration-foreground/60 underline-offset-4">
                      Editar
                    </span>
                  </button>
                </div>

                {/* Trabajo y entregables (read-only) */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Trabajo y entregables
                  </p>
                  <div className="rounded-xl border border-ink/15 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground/90">
                    {desc}
                  </div>
                </div>

                <hr className="border-ink/10" />

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold">
                    Criterios para revisar la entrega
                  </h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {(rules.length
                      ? rules
                      : [
                          "La entrega cumple íntegramente la descripción, los entregables y los formatos confirmados en el acuerdo",
                        ]
                    ).map((criterion, index) => (
                      <li key={index}>{criterion}</li>
                    ))}
                  </ul>
                </section>
                {/* Monto del acuerdo + Plazo de entrega (read-only) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Monto del acuerdo
                    </p>
                    <div className="rounded-xl border border-ink/15 bg-muted/40 px-4 py-2.5 text-base font-semibold text-foreground">
                      {amount || "0"} MON
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Plazo de entrega
                    </p>
                    <div className="rounded-xl border border-ink/15 bg-muted/40 px-4 py-2.5 text-base font-semibold text-foreground">
                      {days || "0"} {Number(days) === 1 ? "día" : "días"}
                    </div>
                  </div>
                </div>

                <hr className="border-ink/10" />

                {/* Participantes */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Participantes
                  </p>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <ParticipantBox
                      roleLabel="Cliente · Tú"
                      address={connected ? address : ""}
                      placeholder="Conecta tu wallet"
                    />
                    <ParticipantBox
                      roleLabel="Proveedor"
                      address={providerTrimmed}
                      placeholder="Sin definir"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Puedes consultar o copiar las direcciones completas con los
                    iconos de cada tarjeta.
                  </p>
                </div>

                <hr className="border-ink/10" />

                {/* Qué ocurre al confirmar */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Qué ocurre al confirmar
                  </p>
                  <ol className="space-y-2">
                    {[
                      "Firmas la transacción en MetaMask",
                      `Se crea el acuerdo y se bloquean ${amount || "0"} MON`,
                      "Compartes el enlace con el proveedor",
                    ].map((item, idx) => (
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
                    <span>El pago se libera cuando apruebas la entrega.</span>
                  </div>
                </div>

                {/* Volver y editar button */}
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={txBusy}
                    onClick={() => go(1)}
                    className="press inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-5 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50 sm:text-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver y editar
                  </button>
                </div>
              </section>

              {/* Right Column: Fondos a bloquear + Tu aprobación libera el pago */}
              <div className="flex flex-col gap-5">
                {/* Top Lime Card: Fondos a bloquear */}
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
                    {/* Header + Padlock Illustration space */}
                    <div className="relative min-h-[126px] pr-36 sm:pr-44">
                      <p className="font-display text-lg font-bold text-ink sm:text-xl">
                        Fondos a bloquear
                      </p>
                      <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
                        {amount || "0"} MON
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-ink/80 sm:text-sm">
                        Monad Testnet · MON de prueba
                      </p>

                      {/* Reserved space for padlock illustration */}
                      <div className="pointer-events-none absolute -right-2 -top-3 w-36 sm:w-44">
                        <IllustrationEscrowLock />
                      </div>
                    </div>

                    {/* Deposit & Network fee breakdown */}
                    <div className="space-y-3 border-y border-ink/20 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3 text-xs font-semibold text-ink sm:text-sm">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                            <Database className="h-4 w-4" strokeWidth={2.2} />
                          </span>
                          Depósito del acuerdo
                        </span>
                        <span className="font-display text-base font-extrabold text-ink sm:text-lg">
                          {amount || "0"} MON
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3 text-xs font-semibold text-ink sm:text-sm">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ink shadow-xs">
                            <Share2 className="h-4 w-4" strokeWidth={2.2} />
                          </span>
                          Comisión de red
                        </span>
                        <span className="text-xs font-semibold text-ink sm:text-sm">
                          Se calcula en MetaMask
                        </span>
                      </div>
                    </div>

                    {/* Balance info note */}
                    <div className="border-b border-ink/20 pb-3.5">
                      <p className="flex items-center gap-2 text-xs font-medium text-ink/85">
                        <Info className="h-4 w-4 shrink-0 text-ink" />
                        <span>
                          Necesitas saldo para el depósito y la comisión de red.
                        </span>
                      </p>
                      {connected && !wrongNetwork && !hasEnoughBalance && (
                        <p className="mt-2 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-primary">
                          Saldo insuficiente en tu wallet ({balance} MON
                          disponibles para bloquear {numAmount} MON).
                        </p>
                      )}
                    </div>

                    {/* Confirmation checkbox (starts unchecked) */}
                    <label className="flex cursor-pointer select-none items-center gap-3 text-xs font-semibold text-ink sm:text-sm">
                      <input
                        type="checkbox"
                        checked={confirmedTerms}
                        disabled={txBusy}
                        onChange={(e) => setConfirmedTerms(e.target.checked)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-ink transition-colors ${
                          confirmedTerms
                            ? "bg-ink text-primary"
                            : "bg-card/85 text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span>
                        He revisado las condiciones y la wallet del proveedor.
                      </span>
                    </label>

                    {/* Transaction error banner with Retry */}
                    <AnimatePresence>
                      {txError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          role="alert"
                          className="space-y-2 rounded-2xl border-2 border-ink bg-card p-3.5 text-xs text-foreground"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                            <p className="font-medium">{txError}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleConfirmAction()}
                            className="press inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-primary"
                          >
                            Reintentar
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Dynamic main action button */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={confirmButtonDisabled}
                        onClick={() => void handleConfirmAction()}
                        className="group press flex w-full items-center justify-between gap-4 rounded-full bg-ink py-2.5 pl-7 pr-2.5 text-sm font-bold text-ink-foreground shadow-[0_4px_0_oklch(0.19_0.01_120/0.25)] transition-all enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none sm:text-base"
                      >
                        <span className="flex-1 text-center">
                          {confirmButtonLabel()}
                        </span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-ink transition-transform duration-300 group-enabled:group-hover:translate-x-0.5">
                          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                        </span>
                      </button>
                      <p className="text-center text-xs font-medium text-ink/75">
                        Se abrirá MetaMask para solicitar tu firma.
                      </p>
                    </div>
                  </div>
                </aside>

                {/* Bottom Dark Card: Tu aprobación libera el pago */}
                <aside className="flex items-center gap-4 rounded-[1.75rem] border-2 border-ink bg-ink p-5 text-ink-foreground sm:p-6">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
                    <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
                  </span>
                  <div className="space-y-0.5">
                    <h3 className="font-display text-base font-bold text-ink-foreground sm:text-lg">
                      Tu aprobación libera el pago
                    </h3>
                    <p className="text-xs leading-relaxed text-ink-foreground/80 sm:text-sm">
                      La IA orienta. Tú firmas la decisión final.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
