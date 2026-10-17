import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import { short, useDemo } from "@/lib/demo";

/** Counts smoothly from the previous value to the new one. */
export function CountUp({ value, decimals = 2, className, from }: { value: number; decimals?: number; className?: string; from?: number }) {
  const reduce = useReducedMotion();
  const prev = useRef(from ?? value);
  const [shown, setShown] = useState(from ?? value);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className}>{shown.toFixed(decimals)}</span>;
}

/**
 * Live "money arrived" moment: a pill drops in from the top like a dynamic island,
 * coins rain across the screen and the amount counts up.
 */
export function MoneyArrival() {
  const { incoming, dismissIncoming } = useDemo();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(dismissIncoming, 6500);
    return () => clearTimeout(t);
  }, [incoming, dismissIncoming]);

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div key={incoming.key} className="pointer-events-none fixed inset-0 z-[70]" exit={{ opacity: 0 }}>
          {/* the island */}
          <motion.div
            className="pointer-events-auto absolute left-1/2 top-3 w-[min(92vw,400px)] -translate-x-1/2"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="relative flex items-center gap-3 overflow-hidden rounded-[2rem] bg-ink p-3 pr-4 text-ink-foreground shadow-2xl ring-1 ring-white/10">
              <div className="circuit pointer-events-none absolute inset-0" />
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <span className="ring-pulse absolute inset-0 rounded-full border-2 border-primary" />
                <motion.span
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-mono text-xl font-bold text-ink"
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: 0 }}
                >
                  M
                </motion.span>
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Pago recibido</p>
                <p className="font-display text-3xl font-bold leading-none">
                  +<CountUp value={incoming.amount} from={0} decimals={incoming.amount % 1 ? 2 : 0} /> <span className="text-base text-ink-foreground/60">MON</span>
                </p>
                <p className="mt-1 truncate text-xs text-ink-foreground/60">
                  de <span className="font-mono">{short(incoming.from)}</span> · {incoming.title}
                </p>
              </div>
              <div className="relative flex flex-col items-end gap-1">
                <button onClick={dismissIncoming} aria-label="Cerrar" className="press rounded-full p-1 text-ink-foreground/50 hover:text-ink-foreground">
                  <X className="h-4 w-4" />
                </button>
                <Link to="/dashboard" onClick={dismissIncoming} className="press flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-ink">
                  Ver <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {/* auto-dismiss timer */}
              <motion.span
                className="absolute bottom-0 left-0 h-1 bg-primary"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 6.5, ease: "linear" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
