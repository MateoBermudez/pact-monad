import { createFileRoute, Link } from "@tanstack/react-router";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { ChevronRight, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { AI_LIMIT_MAX, aiCanRelease, useDemo } from "@/lib/demo";
import { ConnectGate } from "@/components/Shell";
import { IllustrationGauge } from "@/components/Illustrations";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "PACT" },
      { name: "description", content: "Elige hasta qué monto la IA puede liberar pagos por ti. Por encima, siempre se pide tu firma." },
      { property: "og:title", content: "Configuración — PACT" },
      { property: "og:description", content: "Define tu límite de aprobación automática con IA." },
    ],
  }),
  component: () => (
    <ConnectGate>
      <Settings />
    </ConnectGate>
  ),
});

const PRESETS = [5, 10, 25, 50];

function Settings() {
  const { aiAutoApprove, setAiAutoApprove, aiLimit, setAiLimit, pacts } = useDemo();
  const pending = pacts.filter((p) => p.role === "cliente" && ["Creado", "Aceptado", "Entregado"].includes(p.status));
  const fraction = aiAutoApprove ? aiLimit / AI_LIMIT_MAX : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2 pt-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="max-w-xl text-muted-foreground">
          Decide cuánto puede pagar la IA por su cuenta. Por encima de tu límite, el dinero no se mueve sin tu firma.
        </p>
      </div>

      <section className="overflow-hidden rounded-[2rem] bg-primary text-primary-foreground">
        <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Aprobación automática con IA</h2>
                <p className="text-sm opacity-70">
                  La IA revisa cada entrega. Si cumple el acuerdo y el monto está dentro de tu límite, libera el pago sola.
                </p>
              </div>
              <SwitchPrimitive.Root
                checked={aiAutoApprove}
                onCheckedChange={setAiAutoApprove}
                aria-label="Dejar que la IA libere pagos por mí"
                className="press relative mt-1 inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-ink bg-card transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/30 data-[state=checked]:bg-ink"
              >
                <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-ink shadow transition-transform duration-200 ease-out data-[state=checked]:translate-x-7 data-[state=checked]:bg-primary" />
              </SwitchPrimitive.Root>
            </div>

            <div className={`space-y-4 transition-opacity duration-300 ${aiAutoApprove ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!aiAutoApprove}>
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm font-semibold">Tu límite</span>
                <p className="text-4xl font-bold tabular-nums leading-none">
                  {aiLimit} <span className="text-base font-semibold">MON</span>
                </p>
              </div>
              <SliderPrimitive.Root
                value={[aiLimit]}
                onValueChange={([v]) => setAiLimit(v ?? 0)}
                min={0}
                max={AI_LIMIT_MAX}
                step={1}
                disabled={!aiAutoApprove}
                aria-label="Límite de aprobación automática en MON"
                className="relative flex h-8 w-full touch-none select-none items-center"
              >
                <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-ink/15">
                  <SliderPrimitive.Range className="absolute h-full bg-ink" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-7 w-7 cursor-grab rounded-full border-4 border-ink bg-card shadow-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/30 active:scale-95 active:cursor-grabbing" />
              </SliderPrimitive.Root>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAiLimit(v)}
                    className={`press rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${aiLimit === v ? "bg-ink text-primary" : "bg-card/60 hover:bg-card"}`}
                  >
                    {v} MON
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <IllustrationGauge fraction={fraction} />
          </div>
        </div>

        <p className="flex items-start gap-2 border-t border-ink/10 bg-ink/5 px-6 py-4 text-sm sm:px-8">
          {aiAutoApprove ? (
            <>
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Hasta <b>{aiLimit} MON</b> la IA libera el pago cuando la entrega cumple. Por encima de {aiLimit} MON, el pago espera tu firma.
              </span>
            </>
          ) : (
            <>
              <PenLine className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Todos los pagos esperan tu firma. La IA solo te recomienda.</span>
            </>
          )}
        </p>
      </section>

      <section className="card space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold">Así quedan tus acuerdos en curso</h2>
          <p className="text-sm text-muted-foreground">Se actualiza al mover el límite.</p>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes acuerdos en curso como cliente. <Link to="/crear" className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">Crea uno</Link> para verlo aquí.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((p) => {
              const auto = aiCanRelease(p.amount, aiAutoApprove, aiLimit);
              return (
                <li key={p.id}>
                  <Link to="/pact/$id" params={{ id: p.id }} className="press flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{p.amount} MON</span>
                    <span
                      key={String(auto)}
                      className={`pop-in inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${auto ? "bg-primary text-primary-foreground" : "bg-ink text-ink-foreground"}`}
                    >
                      {auto ? <Sparkles className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                      {auto ? "La IA lo libera" : "Tu firma"}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" /> Si la IA marca una entrega para revisar, nunca libera el pago, sin importar el monto.
      </p>
    </div>
  );
}
