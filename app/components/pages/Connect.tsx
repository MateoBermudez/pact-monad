"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, Wallet } from "lucide-react";
import { usePact } from "@/lib/client/pact-context";

export default function Connect() {
  const { signIn } = usePact();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-md space-y-6 pt-6">
      <section className="card space-y-6 border-2 border-ink text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink text-primary">
          <Wallet className="h-7 w-7" />
        </span>
        <h1 className="font-display text-2xl font-bold">
          Inicia sesión en PACT
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecta MetaMask y firma el mensaje de acceso. Verificamos la firma
          con el servidor para abrir tu sesión. No cuesta gas.
        </p>
        {error && (
          <p role="alert" className="rounded-xl bg-warning/10 p-3 text-sm">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="btn-primary w-full"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signIn();
              router.push("/dashboard");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "No se pudo iniciar sesión.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Verificando tu wallet…" : "Conectar y firmar"}
          <Check className="h-4 w-4" />
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Tus claves permanecen en tu wallet.
        </p>
      </section>
    </div>
  );
}
