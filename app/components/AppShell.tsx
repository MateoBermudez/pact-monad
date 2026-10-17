"use client";
import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { PactProvider, usePact } from "@/lib/client/pact-context";
import { Header, Dock } from "./Shell";

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { error } = usePact();
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-48 pt-6">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
          >
            {error}
          </p>
        )}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
      <Dock />
      <Toaster position="bottom-center" offset={104} />
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <PactProvider>
        <Suspense fallback={<p className="p-6">Cargando PACT…</p>}>
          <Shell>{children}</Shell>
        </Suspense>
      </PactProvider>
    </MotionConfig>
  );
}
