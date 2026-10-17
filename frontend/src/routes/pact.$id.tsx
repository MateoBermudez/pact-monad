import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Check, ExternalLink, Loader2, Lock, PenLine, Settings, ShieldCheck, Sparkles, Wallet, X, XCircle } from "lucide-react";
import { CLIENT, EXPLORER, STATUS_BADGE as badge, addDays, aiCanRelease, short, useDemo, type Status } from "@/lib/demo";
import { ApprovalCelebration } from "@/components/Illustrations";

export const Route = createFileRoute("/pact/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "PACT" },
      { name: "description", content: "Consulta y gestiona un acuerdo con MON bloqueados en escrow sobre Monad." },
      { property: "og:title", content: `PACT #${params.id} — Detalle del acuerdo` },
      { property: "og:description", content: "Acuerdo con pago bloqueado en escrow sobre Monad Testnet." },
    ],
  }),
  component: PactPage,
});

const STEPS: Status[] = ["Creado", "Aceptado", "Entregado", "Aprobado"];
const input =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

function PactPage() {
  const { id } = Route.useParams();
  const { pacts, updatePact, connected, setConnected, aiAutoApprove, aiLimit, receive } = useDemo();
  const [aiOk, setAiOk] = useState(true);
  const [aiReleasing, setAiReleasing] = useState(false);
  const pact = pacts.find((p) => p.id === id);
  // When the provider's view flips to Approved, the money lands live.
  const prevStatus = useRef(pact?.status);
  useEffect(() => {
    if (!pact) return;
    if (prevStatus.current !== "Aprobado" && pact.status === "Aprobado" && pact.role === "proveedor") {
      receive(pact.amount, pact.counterparty, pact.title, false);
    }
    prevStatus.current = pact.status;
  }, [pact, receive]);
  if (!pact) {
    return (
      <div className="card space-y-4 text-center">
        <p className="font-semibold">Este acuerdo no existe</p>
        <Link to="/dashboard" className="btn-primary">Ir al dashboard</Link>
      </div>
    );
  }
  const { role, status, amount, days, title, description } = pact;
  const setStatus = (s: Status) => updatePact(id, { status: s });
  const idx = STEPS.indexOf(status);
  const isClient = role === "cliente";
  const clientAddr = isClient ? CLIENT : pact.counterparty;
  const providerAddr = isClient ? pact.counterparty : CLIENT;
  const withinLimit = aiCanRelease(amount, aiAutoApprove, aiLimit);

  const aiRelease = () => {
    setAiReleasing(true);
    setTimeout(() => {
      setAiReleasing(false);
      setStatus("Aprobado");
      toast.success(`La IA liberó ${amount} MON`, { description: "La entrega cumple y el monto está dentro de tu límite." });
    }, 1400);
  };

  const events = [
    { label: `Acuerdo creado y ${amount} MON bloqueados`, by: clientAddr, at: pact.createdAt, show: true },
    { label: "Acuerdo aceptado por el proveedor", by: providerAddr, at: "15 oct, 12:02", show: idx >= 1 },
    { label: "Entrega registrada", by: providerAddr, at: "18 oct, 17:40", show: idx >= 2 },
    { label: `Pago de ${amount} MON liberado`, by: clientAddr, at: "19 oct, 09:15", show: idx >= 3 },
    { label: "Acuerdo cancelado y reembolsado", by: clientAddr, at: "16 oct, 08:30", show: status === "Cancelado" },
  ].filter((e) => e.show);

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mis acuerdos
      </Link>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">PACT #{id}</span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${badge[status]}`}>{status}</span>
          <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">Eres {role}</span>
        </div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      </div>

      {/* Progress */}
      <div className="card">
        {status === "Cancelado" ? (
          <div className="flex items-center justify-center gap-2 py-1 font-semibold text-destructive">
            <XCircle className="h-5 w-5" /> Cancelado
          </div>
        ) : (
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    key={`${s}-${i <= idx}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i <= idx ? "pop-in bg-ink text-primary" : "border bg-card border-border text-muted-foreground"}`}
                    style={i <= idx ? { animationDelay: `${i * 0.06}s` } : undefined}
                  >
                    {i <= idx ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`text-[11px] transition-colors ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-border">
                    <div className={`h-full bg-ink transition-[width] duration-500 ease-out ${i < idx ? "w-full" : "w-0"}`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {status === "Aprobado" && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}
            className="card flex flex-col items-center gap-4 overflow-hidden bg-primary py-12 text-center"
          >
            <ApprovalCelebration amount={amount} />
            <a href={EXPLORER} target="_blank" rel="noreferrer" className="btn-primary animate-in fade-in duration-500" style={{ animationDelay: ".6s", animationFillMode: "both" }}>
              Ver transacción en el explorer <ExternalLink className="h-4 w-4" />
            </a>
          </motion.div>
        )}
        {status === "Cancelado" && (
          <motion.div
            key="cancel"
            initial={{ opacity: 0, y: -20, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
            className="rounded-[2rem] border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.15, stiffness: 300, damping: 12 }}
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            >
              <X className="h-7 w-7" strokeWidth={3} />
            </motion.span>
            <p className="font-semibold">Acuerdo cancelado. {amount} MON devueltos al cliente</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details */}
      <div className="card space-y-5">
        <div className="flex items-center gap-3 rounded-3xl bg-ink p-5 text-ink-foreground">
          <motion.span
            key={status}
            initial={{ rotate: -25, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary"
          ><Lock className="h-5 w-5 text-primary-foreground" /></motion.span>
          <div>
            <p className="font-display text-2xl font-bold">{amount} MON</p>
            <p className="text-xs text-ink-foreground/60">
              {status === "Aprobado" ? "Liberado al proveedor" : status === "Cancelado" ? "Reembolsado al cliente" : "Bloqueado en escrow"}
            </p>
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail k="Cliente" v={<span className="font-mono">{short(clientAddr)}</span>} />
          <Detail k="Proveedor" v={<span className="font-mono">{short(providerAddr)}</span>} />
          <Detail k="Plazo" v={`${days} días · vence ${addDays(days)}`} />
        </dl>
        <Detail k="Descripción" v={description} />
      </div>

      {/* Delivery */}
      {(status === "Entregado" || status === "Aprobado") && (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card space-y-3">
          <h2 className="font-semibold">Entrega</h2>
          <a href="https://example.com/logo-cafeteria.zip" target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-sm text-foreground underline decoration-primary decoration-2 underline-offset-4">
            <ExternalLink className="h-4 w-4 shrink-0" /> example.com/logo-cafeteria.zip
          </a>
          <p className="text-sm">"Entrego logo en PNG y SVG, con versión en blanco y negro"</p>
          <p className="text-xs text-muted-foreground">Entregado el 18 oct 2026, 17:40</p>
        </motion.div>
      )}

      {/* AI recommendation */}
      {status === "Entregado" && isClient && connected && (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Recomendación de la IA</h2>
            <button onClick={() => setAiOk(!aiOk)} className={`press rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${aiOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
              {aiOk ? "Cumple" : "Revisar"}
            </button>
          </div>
          <p key={String(aiOk)} className="text-sm duration-300 animate-in fade-in">
            {aiOk
              ? "El enlace apunta a un archivo de logo y la nota menciona PNG y SVG, como pedía el acuerdo."
              : "No se encontró mención al formato SVG en la entrega. Revisa los archivos antes de aprobar."}
          </p>

          {aiOk && withinLimit ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-primary p-4 text-primary-foreground duration-300 animate-in fade-in slide-in-from-bottom-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                <b>{amount} MON</b> está dentro de tu límite de {aiLimit} MON. La IA puede liberar el pago por ti.
              </p>
              <button onClick={aiRelease} disabled={aiReleasing} className="btn-primary shrink-0 px-4 py-2.5">
                {aiReleasing ? <><Loader2 className="h-4 w-4 animate-spin" /> Liberando…</> : <><Sparkles className="h-4 w-4" /> Dejar que la IA lo libere</>}
              </button>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-2xl bg-muted p-4 text-sm duration-300 animate-in fade-in">
              <PenLine className="mt-0.5 h-4 w-4 shrink-0" />
              {!aiOk
                ? "La IA no libera pagos de entregas marcadas para revisar. Este pago necesita tu firma."
                : !aiAutoApprove
                  ? "Tienes la aprobación automática apagada. Este pago necesita tu firma."
                  : `${amount} MON supera tu límite de ${aiLimit} MON. Este pago necesita tu firma.`}
            </p>
          )}
          <Link to="/configuracion" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Settings className="h-3.5 w-3.5" /> Cambiar mi límite
          </Link>
        </motion.div>
      )}

      {/* Actions */}
      {!connected ? (
        <div className="card flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Conecta tu wallet para participar</p>
          <button onClick={() => setConnected(true)} className="btn-primary"><Wallet className="h-4 w-4" /> Conectar MetaMask</button>
        </div>
      ) : (
        <Actions isClient={isClient} status={status} setStatus={setStatus} amount={amount} />
      )}

      {/* History */}
      <div className="card space-y-1">
        <h2 className="mb-3 font-semibold">Historial</h2>
        <AnimatePresence initial={false}>
        {events.map((e) => (
          <motion.div
            key={e.label}
            layout
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-0"
          >
            <div>
              <p className="text-sm">{e.label}</p>
              <p className="text-xs text-muted-foreground"><span className="font-mono">{short(e.by)}</span> · {e.at}</p>
            </div>
            <a href={EXPLORER} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-foreground underline decoration-primary decoration-2 underline-offset-4">
              Ver en explorer <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Actions({ isClient, status, setStatus, amount }: { isClient: boolean; status: Status; setStatus: (s: Status) => void; amount: number }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Status | null>(null);
  const canCancel = isClient && ["Creado", "Aceptado", "Entregado"].includes(status);
  const hasMain = (!isClient && (status === "Creado" || status === "Aceptado")) || (isClient && status === "Entregado");
  if (!hasMain && !canCancel) return null;

  /** Simulates the wallet signature, then moves the pact and confirms with a toast. */
  const sign = (next: Status, done: string) => {
    setPending(next);
    setTimeout(() => {
      setPending(null);
      setStatus(next);
      toast.success(done);
    }, 1100);
  };
  const busy = pending !== null;
  const waiting = (
    <>
      <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
      Esperando firma…
    </>
  );

  return (
    <div className="card space-y-3">
      {!isClient && status === "Creado" && (
        <button onClick={() => sign("Aceptado", "Acuerdo aceptado")} disabled={busy} className="btn-primary w-full">
          {pending === "Aceptado" ? waiting : "Aceptar acuerdo"}
        </button>
      )}
      {!isClient && status === "Aceptado" && (
        <div className="space-y-3">
          <h2 className="font-semibold">Registrar entrega</h2>
          <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://enlace-a-tu-entrega.com" />
          <textarea rows={3} className={`${input} resize-none`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota para el cliente" />
          <button onClick={() => sign("Entregado", "Entrega registrada")} disabled={busy} className="btn-primary w-full">
            {pending === "Entregado" ? waiting : "Registrar entrega"}
          </button>
        </div>
      )}
      {isClient && status === "Entregado" && (
        <button onClick={() => sign("Aprobado", `Pago de ${amount} MON liberado`)} disabled={busy} className="btn-primary w-full">
          {pending === "Aprobado" ? waiting : `Aprobar y liberar ${amount} MON`}
        </button>
      )}
      {canCancel && (
        <button
          onClick={() => sign("Cancelado", `Acuerdo cancelado. ${amount} MON reembolsados`)}
          disabled={busy}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
        >
          {pending === "Cancelado" ? waiting : <><X className="h-4 w-4" /> Cancelar y reembolsar</>}
        </button>
      )}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="text-sm">{v}</dd>
    </div>
  );
}

