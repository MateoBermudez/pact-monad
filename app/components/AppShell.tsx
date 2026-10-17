"use client";
import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { PactProvider, usePact } from "@/lib/client/pact-context";
import { useHydrated } from "@/lib/client/use-hydrated";
import {
  isPublicPath,
  LANDING_PATH,
  ONBOARDING_PATH,
} from "@/lib/shared/routes";
import { Header, Dock, type HeaderVariant } from "./Shell";

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const authScreen = pathname === "/iniciar-sesion" || pathname === "/registro";
  const { error, signedIn, loading } = usePact();
  const hydrated = useHydrated();
  const onboarding =
    (isPublicPath(pathname) && pathname !== LANDING_PATH) ||
    pathname === ONBOARDING_PATH || pathname === "/bienvenida";
  const onLanding = pathname === LANDING_PATH;
  const sessionKnown = hydrated && !loading;
  const guestLanding = onLanding && sessionKnown && !signedIn;
  const pendingLanding = onLanding && !sessionKnown;
  const variant: HeaderVariant =
    onboarding || pendingLanding ? "minimal" : guestLanding ? "guest" : "full";
  const showDock = !onboarding && !guestLanding && !pendingLanding;
  return (
    <div className={authScreen ? "auth-screen-frame" : undefined}>
      <div className={onboarding ? "onboarding-shell" : "min-h-screen"}>
        <Header variant={variant} />
        <main
          className={
            onboarding
              ? "mx-auto max-w-6xl px-4 pb-4 pt-2"
              : "mx-auto max-w-5xl px-4 pb-48 pt-6"
          }
        >
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
        {showDock && <Dock />}
        <Toaster position="bottom-center" offset={104} />
      </div>
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<p className="p-6">Cargando PACT…</p>}>
        <PactProvider>
          <Shell>{children}</Shell>
        </PactProvider>
      </Suspense>
    </MotionConfig>
  );
}
