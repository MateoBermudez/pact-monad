"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Github, LockKeyhole } from "lucide-react";
import { AuthIllustration } from "./AuthIllustration";

export function SocialAuth({ register = false }: { register?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function start(provider: "google" | "github") {
    setBusy(provider);
    setError("");
    try {
      const response = await fetch("/api/auth/identities", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 200) {
        router.push("/perfil");
        return;
      }
      if (response.status !== 401)
        throw new Error(
          "El acceso social aún no está disponible. Inténtalo más tarde.",
        );
      // OAuth must use a document navigation to follow the external provider redirect.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(
        `/api/auth/oauth/${provider}?next=${encodeURIComponent("/dashboard")}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar sesión.");
      setBusy(null);
    }
  }
  return (
    <section className={register ? "auth-layout auth-layout-register" : "auth-layout"}>
      <div className="auth-hero">
        <div className="auth-hero-copy">
          <h1>
            {register ? (
              <>
                El próximo
                <br />
                gran proyecto
                <br />
                empieza aquí.
              </>
            ) : (
              <>
                Tus acuerdos,
                <br />
                en un solo lugar.
              </>
            )}
          </h1>
          <p>
            {register
              ? "Conecta ideas con personas que las hacen realidad."
              : "Conecta talento. Construye confianza."}
          </p>
        </div>
        <AuthIllustration register={register} />
      </div>
      <div className="auth-card">
        <h2>{register ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
        <p className="auth-muted">
          {register
            ? "Regístrate con tu cuenta de Google o GitHub."
            : "Inicia sesión para continuar en PACT."}
        </p>
        <div className="social-actions">
          {(["google", "github"] as const).map((provider) => (
            <button
              key={provider}
              disabled={!!busy}
              onClick={() => void start(provider)}
              className="social-button"
            >
              {provider === "google" ? (
                <GoogleMark />
              ) : (
                <Github size={25} fill="currentColor" />
              )}
              <span>
                {busy === provider
                  ? "Conectando…"
                  : `${register ? "Registrarme" : "Continuar"} con ${provider === "google" ? "Google" : "GitHub"}`}
              </span>
              <ArrowRight size={20} />
            </button>
          ))}
        </div>
        {(error || params.has("auth_error")) && (
          <p role="alert" className="auth-error">
            {error ||
              "No se pudo completar el acceso. Vuelve a intentarlo con Google o GitHub."}
          </p>
        )}
        <div className="auth-footer">
          {register && (
            <p>
              Al continuar, aceptas los <Link href="/terminos">Términos</Link> y
              conoces la <Link href="/privacidad">Política de privacidad</Link>.
            </p>
          )}
          <p>
            {register ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
            <Link href={register ? "/iniciar-sesion" : "/registro"}>
              {register ? "Inicia sesión" : "Regístrate"}
            </Link>
          </p>
          {!register && (
            <p className="wallet-note">
              <LockKeyhole size={15} />
              Tu wallet se conecta cuando necesites crear o gestionar un
              acuerdo.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="25" height="25" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.6a4.8 4.8 0 0 1-2.1 3.2v2.7H19c2-1.9 3-4.6 3-7.9Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.8 0 5.2-.9 7-2.5l-3.5-2.7c-1 .7-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.6v2.8A10.5 10.5 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.2 13.5a6.3 6.3 0 0 1 0-4V6.7H2.6a10.4 10.4 0 0 0 0 9.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.2c1.5 0 2.8.5 3.8 1.5l3.1-3.1A10 10 0 0 0 12 1a10.5 10.5 0 0 0-9.4 5.7l3.6 2.8C7 7 9.3 5.2 12 5.2Z"
      />
    </svg>
  );
}
