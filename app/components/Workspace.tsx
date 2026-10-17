"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/client/api";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(path);
      setData(result);
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los datos.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const controller = new AbortController();
    void api<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar los datos.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path]);
  return { data, error, loading, reload };
}
export function Workspace({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const path = usePathname();
  const nav = [
    ["/explorar", "Explorar"],
    ["/solicitudes", "Mis solicitudes"],
    ["/postulaciones", "Postulaciones"],
    ["/portafolio", "Portafolio"],
    ["/creditos", "Créditos"],
    ["/cuenta", "Mi cuenta"],
  ];
  return (
    <div className="workspace">
      <nav className="workspace-nav" aria-label="Tu espacio en PACT">
        {nav.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <header className="workspace-title">
        <span className="workspace-eyebrow">PACT / Tu espacio de trabajo</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {children}
    </div>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => unknown;
}) {
  return (
    <>
      {loading && (
        <p role="status" className="workspace-state">
          Cargando…
        </p>
      )}
      {error && (
        <div role="alert" className="workspace-state error">
          <p>{error}</p>
          <button type="button" onClick={() => void retry()}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      )}
    </>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="workspace-empty">{children}</div>;
}
export function Metric({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="workspace-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
export function ActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="workspace-link" href={href}>
      {children}
      <ArrowUpRight size={18} />
    </Link>
  );
}
export const messageOf = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "No se pudo completar la acción. Inténtalo de nuevo.";
