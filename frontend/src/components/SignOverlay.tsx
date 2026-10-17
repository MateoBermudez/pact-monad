import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Full-screen signing moment: coins fly from the wallet into a padlock that snaps shut,
 * then the lock turns into a check. Driven by the same waiting/done states the form uses.
 */
export function SignOverlay({ state, amount }: { state: "idle" | "waiting" | "done"; amount: number }) {
  const reduce = useReducedMotion();
  const done = state === "done";
  return (
    <AnimatePresence>
      {state !== "idle" && (
        <motion.div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-ink/80 px-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.7, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-[2.5rem] bg-primary p-8 text-center text-primary-foreground"
          >
            <div className="relative flex h-40 w-40 items-center justify-center">
              {/* pulse rings */}
              <span className="ring-pulse absolute inset-0 rounded-full border-2 border-ink" />
              <span className="ring-pulse absolute inset-0 rounded-full border-2 border-ink" style={{ animationDelay: ".5s" }} />
              {/* coins flowing in */}
              {!reduce && !done &&
                [0, 1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-card font-mono text-[11px] font-bold"
                    initial={{ x: -150 + i * 8, y: 60 - i * 22, opacity: 0, scale: 0.7 }}
                    animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.3] }}
                    transition={{ duration: 1.1, delay: i * 0.38, repeat: Infinity, repeatDelay: 0.2, ease: "easeIn" }}
                  >
                    M
                  </motion.span>
                ))}
              <motion.div
                className="relative flex h-28 w-28 items-center justify-center rounded-full bg-ink"
                animate={done ? { scale: [1, 1.18, 1] } : { rotate: [0, -4, 4, 0] }}
                transition={done ? { duration: 0.5 } : { duration: 1.6, repeat: Infinity }}
              >
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.svg key="check" viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="var(--primary)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.1 }} />
                    </motion.svg>
                  ) : (
                    <motion.svg key="lock" viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="var(--primary)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" exit={{ scale: 0.4, opacity: 0 }}>
                      <rect x={5} y={11} width={14} height={10} rx={2.5} fill="var(--primary)" stroke="none" />
                      <motion.path d="M8 11V8a4 4 0 0 1 8 0v3" animate={{ y: [-3, 0, 0, -3] }} transition={{ duration: 1.6, repeat: Infinity, times: [0, 0.35, 0.8, 1] }} />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={state}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-1"
              >
                <p className="font-display text-2xl font-bold">{done ? "Acuerdo creado" : "Esperando firma en MetaMask…"}</p>
                <p className="text-sm opacity-70">
                  {done ? `${amount} MON bloqueados en escrow.` : `Confirma en tu wallet para bloquear ${amount} MON.`}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
