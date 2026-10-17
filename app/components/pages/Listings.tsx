"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import {
  Workspace,
  LoadState,
  Empty,
  useResource,
  messageOf,
} from "@/components/Workspace";
import { api, jsonRequest } from "@/lib/client/api";
import type {
  ListingDto,
  ApplicationDto,
  ListingStatus,
} from "@/lib/shared/listings";
const statuses: Record<ListingStatus, string> = {
  draft: "Borrador",
  open: "Recibiendo propuestas",
  selecting: "En selección",
  awarded: "Proveedor elegido",
  closed: "Cerrada",
};
export function MyListings() {
  const state = useResource<{ listings: ListingDto[] }>(
    "/api/listings?scope=mine&limit=100",
  );
  return (
    <Workspace
      title="Tus ideas en marcha."
      intro="Publica una oportunidad, revisa las propuestas y elige con quién trabajar."
    >
      <div className="workspace-toolbar">
        <h2>Mis solicitudes</h2>
        <Link className="btn-primary" href="/crear">
          <Plus size={18} /> Nueva oportunidad
        </Link>
      </div>
      <LoadState {...state} retry={state.reload} />
      <div className="workspace-list">
        {state.data?.listings.map((item) => (
          <Link
            key={item.id}
            href={`/solicitudes/${item.id}`}
            className="workspace-row"
          >
            <div>
              <span className="workspace-pill">{statuses[item.status]}</span>
              <h2>{item.title}</h2>
              <p>
                {item.applicationsCount} postulaciones ·{" "}
                {item.deadlineDays ?? "—"} días
              </p>
            </div>
            <strong>{item.budgetMon ?? "—"} MON</strong>
            <ArrowUpRight />
          </Link>
        ))}
      </div>
      {state.data?.listings.length === 0 && (
        <Empty>
          Aún no has publicado oportunidades.{" "}
          <Link href="/crear">Cuenta qué necesitas.</Link>
        </Empty>
      )}
    </Workspace>
  );
}
type MyApplication = ApplicationDto & {
  listingTitle: string;
  listingStatus: ListingStatus;
};
export function MyApplications() {
  const state = useResource<{ applications: MyApplication[] }>(
    "/api/applications",
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const labels = {
    submitted: "Enviada",
    shortlisted: "Preseleccionada",
    rejected: "No seleccionada",
    selected: "Seleccionada",
    withdrawn: "Retirada",
  };
  return (
    <Workspace
      title="Tu talento está en juego."
      intro="Sigue tus propuestas y los próximos pasos con cada cliente."
    >
      <LoadState {...state} retry={state.reload} />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <div className="workspace-list">
        {state.data?.applications.map((item) => (
          <article className="workspace-card" key={item.id}>
            <span className="workspace-pill">{labels[item.status]}</span>
            <h2>
              <Link href={`/solicitudes/${item.listingId}`}>
                {item.listingTitle}
              </Link>
            </h2>
            <p>{item.message}</p>
            <p>
              {item.priceMon ?? "Presupuesto de la oportunidad"}
              {item.priceMon ? " MON" : ""} ·{" "}
              {item.days ? `${item.days} días` : "Plazo de la oportunidad"}
            </p>
            {item.status === "selected" ? (
              <p className="workspace-notice">
                Te eligieron. Cuando el cliente bloquee los fondos, verás el
                acuerdo en Mis acuerdos.
              </p>
            ) : (
              ["submitted", "shortlisted"].includes(item.status) && (
                <button
                  className="btn-secondary"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(item.id);
                    setError("");
                    try {
                      await api(
                        `/api/applications/${item.id}`,
                        jsonRequest("PATCH", { action: "withdraw" }),
                      );
                      await state.reload();
                    } catch (e) {
                      setError(messageOf(e));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {busy === item.id ? "Retirando…" : "Retirar propuesta"}
                </button>
              )
            )}
          </article>
        ))}
      </div>
      {state.data?.applications.length === 0 && (
        <Empty>
          Aún no has enviado propuestas.{" "}
          <Link href="/explorar">Explora las oportunidades.</Link>
        </Empty>
      )}
    </Workspace>
  );
}
