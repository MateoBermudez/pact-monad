import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PACT", template: "%s — PACT" },
  description: "Acuerdos de trabajo con pago bloqueado en escrow sobre Monad.",
  icons: { icon: "/pact-logo.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className="dark"
    >
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
