import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Check, Loader2, PenLine, ShieldCheck, Wallet } from "lucide-react";
import { short, useDemo } from "@/lib/demo";
import { signWithMetaMask } from "@/lib/wallet";

export const Route = createFileRoute("/conectar")({
  head: () => ({
    meta: [
      { title: "PACT" },
      { name: "description", content: "Identifícate en PACT con MetaMask. Tu wallet es tu cuenta." },
      { property: "og:title", content: "Conectar wallet — PACT" },
      { property: "og:description", content: "Accede a PACT con tu wallet, sin contraseñas." },
    ],
  }),
  component: Connect,
});

type Step = "idle" | "connecting" | "sign" | "signing" | "done";

function Connect() {
  const { address, connectWallet } = useDemo();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nonce] = useState(() => Math.random().toString(16).slice(2, 10));

  const connect = async () => {
    setErrorMsg(null);
    setStep("connecting");
    try {
      await connectWallet();
      setStep("sign");
    } catch (err) {
      setStep("idle");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar con MetaMask.");
    }
  };

  const sign = async () => {
    setErrorMsg(null);
    setStep("signing");
    try {
      const message = `Iniciar sesión en PACT\nWallet: ${address}\nNonce: ${nonce}`;
      await signWithMetaMask(address, message);
      setStep("done");
      setTimeout(() => navigate({ to: "/dashboard" }), 800);
    } catch (err) {
      setStep("sign");
      setErrorMsg(err instanceof Error ? err.message : "Se canceló la firma en MetaMask.");
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pt-6">
      <div className="card space-y-6 text-center">
        <span
          key={step === "done" ? "done" : "wallet"}
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink ${step === "done" ? "pop-in shadow-[var(--shadow-glow)]" : ""}`}
        >
          {step === "done" ? <Check className="h-7 w-7 text-primary" strokeWidth={3} /> : <Wallet className="h-7 w-7 text-primary" />}
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {step === "done" ? "¡Listo!" : step === "sign" || step === "signing" ? "Confirma que eres tú" : "Entra con tu wallet"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "sign" || step === "signing"
              ? "Firma un mensaje para verificar tu identidad. No cuesta gas."
              : step === "done"
                ? "Identidad verificada. Entrando a tu dashboard…"
                : "En PACT tu dirección de wallet es tu identidad. No necesitas correo ni contraseña."}
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-left text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {(step === "sign" || step === "signing") && (
          <div className="rounded-2xl border border-border bg-background p-4 text-left font-mono text-xs leading-relaxed">
            <p className="text-muted-foreground">Mensaje a firmar</p>
            <p className="mt-2">Iniciar sesión en PACT</p>
            <p>Wallet: {short(address)}</p>
            <p>Nonce: {nonce}</p>
          </div>
        )}

        {step === "idle" && (
          <button onClick={() => void connect()} className="btn-primary w-full"><Wallet className="h-4 w-4" /> Conectar MetaMask</button>
        )}
        {step === "connecting" && (
          <button disabled className="btn-primary w-full"><Loader2 className="h-4 w-4 animate-spin" /> Abriendo MetaMask…</button>
        )}
        {step === "sign" && (
          <button onClick={() => void sign()} className="btn-primary w-full"><PenLine className="h-4 w-4" /> Firmar mensaje</button>
        )}
        {step === "signing" && (
          <button disabled className="btn-primary w-full"><Loader2 className="h-4 w-4 animate-spin" /> Esperando firma…</button>
        )}
      </div>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" /> PACT nunca tiene acceso a tus fondos ni a tus claves.
      </p>
    </div>
  );
}
