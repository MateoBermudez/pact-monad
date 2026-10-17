import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, PenLine, Sparkles, Undo2, Wand2 } from "lucide-react";
import { addDays, short, useDemo } from "@/lib/demo";
import { ConnectGate } from "@/components/Shell";
import { SignOverlay } from "@/components/SignOverlay";

export const Route = createFileRoute("/crear")({
  head: () => ({
    meta: [
      { title: "PACT" },
      { name: "description", content: "Describe el trabajo, la IA lo estructura y bloqueas MON en escrow hasta aprobar la entrega." },
      { property: "og:title", content: "Nuevo acuerdo — PACT" },
      { property: "og:description", content: "Crea un acuerdo de trabajo con pago bloqueado en escrow sobre Monad." },
    ],
  }),
  component: () => (
    <ConnectGate>
      <Index />
    </ConnectGate>
  ),
});

const input =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";

const EXAMPLE = "Quiero un logo para una cafetería y pagaré 10 MON";
const THINKING = ["Leyendo tu texto", "Detectando monto y plazo", "Definiendo los entregables", "Armando el acuerdo"];

type Choice = "mine" | "ai";
type View = "compare" | Choice;

/** Fake "AI": pulls the amount and deadline out of the text and rewrites it as a clear brief. */
function refine(text: string) {
  const amount = text.match(/(\d+(?:[.,]\d+)?)\s*MON/i)?.[1]?.replace(",", ".") ?? "10";
  const days = text.match(/(\d+)\s*d[ií]as?/i)?.[1] ?? "7";
  const core = text
    .replace(/(,|\sy)?\s*(pagar[eé]|pagar[ií]a|pago|por)\s*\d+(?:[.,]\d+)?\s*MON/gi, "")
    .replace(/\d+(?:[.,]\d+)?\s*MON/gi, "")
    .replace(/,?\s*(en|con un plazo de)\s*\d+\s*d[ií]as?/gi, "")
    .replace(/^\s*(quiero|necesito|busco)\s+/i, "")
    .replace(/(\s*,)+/g, ",")
    .replace(/^[.,;\s]+|[.,;\s]+$/g, "")
    .trim();
  const deliverable = /logo|dise[ñn]o|ilustra|banner/i.test(text) ? "entrega en PNG y SVG" : "entrega verificable mediante enlace";
  const head = core ? core.charAt(0).toUpperCase() + core.slice(1) : "Trabajo a medida";
  return { desc: `${head}, ${deliverable}`, amount, days, deliverable };
}

/** Wraps the amounts/deadlines the AI picked up in a lime marker. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:[.,]\d+)?\s*(?:MON|d[ií]as?))/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^\d/.test(p) ? (
          <mark key={i} className="rounded-md bg-primary px-1 text-primary-foreground">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const STEPS = ["Describe", "Compara", "Detalles", "Firma"] as const;

/** Progress bar for the wizard: filled line, check marks for finished steps, clickable to go back. */
function Stepper({ step, onGo, skipped }: { step: number; onGo: (n: number) => void; skipped: boolean }) {
  return (
    <nav aria-label="Progreso del acuerdo" className="py-2">
      <ol className="relative flex items-start justify-between">
        {/* track + fill, drawn between the first and last node centres */}
        <div className="absolute left-[12.5%] right-[12.5%] top-4 h-1 rounded-full bg-ink/15" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-ink"
            initial={false}
            animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          const isSkipped = skipped && i === 1 && step > 1;
          return (
            <li key={label} className="relative z-10 flex w-1/4 flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={!done}
                onClick={() => onGo(i)}
                aria-current={current ? "step" : undefined}
                aria-label={`Paso ${i + 1}: ${label}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
                  done ? "bg-ink text-primary" : current ? "bg-primary text-primary-foreground ring-4 ring-primary/30" : "border border-border bg-card text-muted-foreground"
                } ${done ? "cursor-pointer" : "cursor-default"}`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </button>
              <span className={`text-[11px] font-semibold transition-colors ${current ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
                {isSkipped && <span className="block text-center text-[9px] font-normal">omitido</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function NavButtons({ onBack, onNext, nextLabel, nextDisabled }: { onBack?: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Atrás</button>
      ) : (
        <span />
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="btn-primary">
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Index() {
  const { aiFail, addPact } = useDemo();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkIdx, setThinkIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [aiDesc, setAiDesc] = useState("");
  const [choice, setChoice] = useState<Choice>("ai");
  const [view, setView] = useState<View>("compare");
  const [added, setAdded] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [provider, setProvider] = useState("");
  const [sign, setSign] = useState<"idle" | "waiting" | "done">("idle");

  useEffect(() => {
    if (!loading) return;
    setThinkIdx(0);
    const t = setInterval(() => setThinkIdx((i) => Math.min(i + 1, THINKING.length - 1)), 420);
    return () => clearInterval(t);
  }, [loading]);

  const desc = choice === "ai" ? aiDesc : original;
  const setDesc = (v: string) => (choice === "ai" ? setAiDesc(v) : setOriginal(v));
  const changed = useMemo(() => aiDesc.trim() !== original.trim(), [aiDesc, original]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const structure = () => {
    const text = prompt.trim() || EXAMPLE;
    setLoading(true);
    setTimeout(() => {
      setFailed(aiFail);
      setOriginal(text);
      if (aiFail) {
        setAiDesc(""); setAmount(""); setDays(""); setAdded(""); setChoice("mine");
      } else {
        const r = refine(text);
        setAiDesc(r.desc); setAmount(r.amount); setDays(r.days); setAdded(r.deliverable); setChoice("ai"); setView("compare");
      }
      setLoading(false);
      // When the AI fails there is nothing to compare: go straight to filling in the details.
      go(aiFail ? 2 : 1);
    }, 1700);
  };

  const submit = () => {
    setSign("waiting");
    setTimeout(() => setSign("done"), 1900);
    setTimeout(() => {
      const d = desc.trim() || "Nuevo acuerdo";
      const id = addPact({
        title: (d.split(/[,.]/)[0] ?? d).slice(0, 60),
        description: d,
        amount: Number(amount) || 0,
        days: Number(days) || 0,
        counterparty: provider.trim() || "0x0000000000000000000000000000000000000000",
      });
      toast.success("Acuerdo creado", { description: `${Number(amount) || 0} MON bloqueados en escrow.` });
      navigate({ to: "/pact/$id", params: { id } });
    }, 3400);
  };

  const detailsOk = desc.trim().length > 0 && Number(amount) > 0 && Number(days) > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3 pt-2">
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
          Describe lo que necesitas.{" "}
          <span className="rounded-2xl bg-primary px-2 box-decoration-clone">PACT lo convierte en un acuerdo.</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          La IA estructura el acuerdo, tú lo revisas y firmas. Los fondos quedan bloqueados en el contrato.
        </p>
      </div>

      <Stepper step={step} onGo={go} skipped={failed} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 18 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 * dir }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* 1 · Prompt */}
          {step === 0 && (
            <section className="card space-y-4">
              <h2 className="font-display text-lg font-semibold">Describe el trabajo</h2>
              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE}
                className={`${input} resize-none text-base`}
              />
              <button onClick={structure} disabled={loading} className="btn-primary w-full sm:w-auto">
                {loading ? (
                  <>
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                    Estructurando tu acuerdo…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Estructurar con IA
                  </>
                )}
              </button>
              <AnimatePresence>
                {loading && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="space-y-3 rounded-2xl bg-ink p-4 text-ink-foreground">
                      <ul className="space-y-1.5 text-sm">
                        {THINKING.map((t, i) => (
                          <li key={t} className={`flex items-center gap-2 transition-opacity ${i <= thinkIdx ? "opacity-100" : "opacity-30"}`}>
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${i < thinkIdx ? "bg-primary text-ink" : "border border-white/30"}`}>
                              {i < thinkIdx && <Check className="h-3 w-3" strokeWidth={3} />}
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
            </section>
          )}

          {/* 2 · Compare */}
          {step === 1 && (
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Compara y elige tu versión</h2>
                <div role="tablist" aria-label="Ver versiones" className="relative flex rounded-full bg-muted p-1 text-xs font-semibold">
                  {([["compare", "Los dos"], ["mine", "Mi texto"], ["ai", "Versión IA"]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={view === v}
                      onClick={() => setView(v)}
                      className={`relative rounded-full px-3 py-1.5 transition-colors ${view === v ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {view === v && (
                        <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.25 }} />
                      )}
                      <span className="relative">{l}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`grid gap-3 ${view === "compare" ? "md:grid-cols-2" : ""}`}>
                {(view === "compare" || view === "mine") && (
                  <VersionCard
                    key="mine"
                    tone="mine"
                    title="Lo que escribiste"
                    icon={<PenLine className="h-4 w-4" />}
                    selected={choice === "mine"}
                    onPick={() => setChoice("mine")}
                    pickLabel="Usar mi texto"
                  >
                    <p className="text-sm leading-relaxed">
                      <Highlighted text={original} />
                    </p>
                  </VersionCard>
                )}
                {(view === "compare" || view === "ai") && (
                  <VersionCard
                    key="ai"
                    tone="ai"
                    title="Refinado por la IA"
                    icon={<Wand2 className="h-4 w-4" />}
                    selected={choice === "ai"}
                    onPick={() => setChoice("ai")}
                    pickLabel="Usar versión IA"
                  >
                    <textarea
                      rows={3}
                      value={aiDesc}
                      onChange={(e) => { setAiDesc(e.target.value); setChoice("ai"); }}
                      className="w-full resize-none rounded-xl bg-transparent text-sm leading-relaxed outline-none"
                      aria-label="Versión de la IA, editable"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[`+ ${added}`, `Monto ${amount} MON`, `Plazo ${days} días`].map((c) => (
                        <span key={c} className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-primary">{c}</span>
                      ))}
                    </div>
                  </VersionCard>
                )}
              </div>

              {changed && (
                <button
                  onClick={() => setChoice(choice === "ai" ? "mine" : "ai")}
                  className="press inline-flex items-center gap-1.5 text-xs font-semibold underline decoration-primary decoration-2 underline-offset-4"
                >
                  <Undo2 className={`h-3.5 w-3.5 ${choice === "mine" ? "scale-x-[-1]" : ""}`} />
                  {choice === "ai" ? "Volver a mi texto original" : "Volver a la versión de la IA"}
                </button>
              )}
              <NavButtons onBack={() => go(0)} onNext={() => go(2)} nextLabel="Siguiente" />
            </div>
          )}

          {/* 3 · Details */}
          {step === 2 && (
            <div className="card space-y-5">
              <h2 className="font-display text-lg font-semibold">Revisa los detalles</h2>
              {failed && (
                <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> La IA no respondió. Completa los campos a mano
                </div>
              )}
              <Field label="Descripción del trabajo">
                <textarea rows={2} className={`${input} resize-none`} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Monto">
                  <div className="relative">
                    <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold">MON</span>
                  </div>
                </Field>
                <Field label="Plazo">
                  <div className="relative">
                    <input className={input} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">días</span>
                  </div>
                  {Number(days) > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Fecha límite: {addDays(Number(days))}</p>}
                </Field>
              </div>
              <Field label="Dirección del proveedor">
                <input className={`${input} font-mono`} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="0x..." />
              </Field>
              <NavButtons onBack={() => go(failed ? 0 : 1)} onNext={() => go(3)} nextLabel="Siguiente" nextDisabled={!detailsOk} />
            </div>
          )}

          {/* 4 · Sign */}
          {step === 3 && (
            <div className="card space-y-5">
              <h2 className="font-display text-lg font-semibold">Confirma y firma</h2>
              <div className="space-y-4 rounded-3xl bg-ink p-5 text-ink-foreground">
                <p className="text-sm leading-relaxed">{desc}</p>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4">
                  <div>
                    <p className="text-xs text-ink-foreground/60">Se bloquean en escrow</p>
                    <p className="font-display text-3xl font-bold text-primary">{amount} MON</p>
                  </div>
                  <div className="text-right text-xs text-ink-foreground/60">
                    <p>{days} días · vence {addDays(Number(days))}</p>
                    <p className="font-mono">Proveedor {provider ? short(provider) : "por definir"}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">La IA solo propone. Tú confirmas y firmas desde tu wallet.</p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={() => go(2)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Atrás</button>
                <button onClick={submit} disabled={sign !== "idle"} className="btn-primary">
                  Firmar y bloquear {amount || "0"} MON <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <SignOverlay state={sign} amount={Number(amount) || 0} />
    </div>
  );
}

function VersionCard({
  tone, title, icon, selected, onPick, pickLabel, children,
}: {
  tone: "mine" | "ai"; title: string; icon: ReactNode; selected: boolean; onPick: () => void; pickLabel: string; children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`relative flex flex-col gap-3 rounded-3xl p-4 transition-shadow ${
        tone === "ai" ? "bg-primary/25" : "bg-muted"
      } ${selected ? "ring-2 ring-ink" : "ring-1 ring-border"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${tone === "ai" ? "bg-ink text-primary" : "bg-card"}`}>{icon}</span>
          {title}
        </p>
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-primary"
            >
              <Check className="h-3 w-3" strokeWidth={3} /> En uso
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex-1">{children}</div>
      {!selected && (
        <button onClick={onPick} className="btn-secondary w-full py-2 text-xs">{pickLabel}</button>
      )}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
