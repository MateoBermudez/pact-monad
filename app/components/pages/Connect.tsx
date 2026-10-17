"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck, Wallet } from "lucide-react";
import { usePact } from "@/lib/client/pact-context";

export default function Connect() {
  const { signIn, signedIn, connected, loading } = usePact();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Con la wallet ya conectada y verificada no hay nada que hacer aquí.
    if (!loading && signedIn && connected) router.replace("/dashboard");
  }, [loading, signedIn, connected, router]);
  if (loading) return <p role="status">Cargando tu sesión…</p>;
  if (!signedIn)
    return (
      <section className="card mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-bold">Primero inicia sesión</h1>
        <p>Accede con Google o GitHub antes de conectar MetaMask.</p>
        <Link href="/iniciar-sesion" className="btn-primary">
          Iniciar sesión
        </Link>
      </section>
    );
  return (
    <div className="mx-auto max-w-md space-y-6 pt-6">
      <section className="card space-y-6 border-2 border-ink text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink text-primary">
          <Wallet className="h-7 w-7" />
        </span>
        <h1 className="font-display text-2xl font-bold">Vincula tu wallet</h1>
        <p className="text-sm text-muted-foreground">
          Conecta MetaMask y firma un mensaje para demostrar que la dirección es
          tuya. La guardaremos en tu cuenta para las transacciones. Esta firma
          no cuesta gas.
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
