"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpRight } from "lucide-react";
import {
  Workspace,
  LoadState,
  Empty,
  useResource,
  messageOf,
} from "@/components/Workspace";
import { FileUpload } from "@/components/FileUpload";
import { api, jsonRequest } from "@/lib/client/api";
import type {
  ListingDto,
  StructureResultDto,
  ApplicationDto,
  ListingStatus,
} from "@/lib/shared/listings";
import type { FileDto } from "@/lib/shared/files";
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
        <Link className="btn-primary" href="/solicitudes/nueva">
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
          <Link href="/solicitudes/nueva">Cuenta qué necesitas.</Link>
        </Empty>
      )}
    </Workspace>
  );
}
export function NewListing() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<FileDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  async function create(ai: boolean) {
    if (busy || uploading) return;
    setBusy(true);
    setError("");
    let id = created;
    try {
      if (!id) {
        const result = await api<{ listing: ListingDto }>(
          "/api/listings",
          jsonRequest("POST", {
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(file ? { briefFileId: file.id } : {}),
          }),
        );
        id = result.listing.id;
        setCreated(id);
      }
      if (ai)
        await api<StructureResultDto>(`/api/listings/${id}/structure`, {
          method: "POST",
        });
      router.push(`/solicitudes/${id}`);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title="Abre la puerta a tu idea."
      intro="Describe el trabajo o adjunta un brief. Después podrás revisar todas las condiciones antes de publicar."
    >
      <form
        className="workspace-card workspace-form"
        onSubmit={(e) => {
          e.preventDefault();
          void create(true);
        }}
      >
        <label htmlFor="brief-description">¿Qué necesitas?</label>
        <textarea
          id="brief-description"
          minLength={10}
          maxLength={5000}
          value={description}
          disabled={busy || !!created}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cuéntanos el objetivo, los entregables, tu presupuesto y el plazo…"
          rows={7}
        />
        <FileUpload
          purpose="brief"
          value={file}
          onChange={setFile}
          onBusyChange={setUploading}
          disabled={busy || !!created}
        />
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        <div className="workspace-actions">
          <button
            className="btn-primary"
            disabled={
              busy || uploading || (!file && description.trim().length < 10)
            }
          >
            {busy ? "Preparando…" : "Estructurar con IA"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={
              busy || uploading || (!file && description.trim().length < 10)
            }
            onClick={() => void create(false)}
          >
            Completar manualmente
          </button>
          {created && (
            <Link href={`/solicitudes/${created}`}>
              Abrir borrador guardado
            </Link>
          )}
        </div>
        <p className="field-help">
          Se guarda un borrador. Publicar una oportunidad no bloquea fondos.
        </p>
      </form>
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
