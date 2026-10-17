"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AgreementDetailDto,
  ReviewOutcomeDto,
} from "@/lib/shared/agreements";
import { STATUS_NAMES, STATUS_BADGE, short } from "@/lib/shared/ui-pact";
import { EXPLORER_URL } from "@/lib/shared/chain";
import { api, jsonRequest } from "@/lib/client/api";
import { sendEscrowAction } from "@/lib/client/escrow-wallet";
import { usePact } from "@/lib/client/pact-context";
import { subscribeToChanges } from "@/lib/client/realtime";
import { AgreementChat } from "@/components/AgreementChat";
import { FileUpload, FileLink } from "@/components/FileUpload";
import type { FileDto } from "@/lib/shared/files";
import { fileReference, referencedFileId } from "@/lib/shared/file-reference";
import {
  deliveryNoteError,
  deliveryUrlError,
  MAX_DELIVERY_NOTE_BYTES,
  utf8Length,
} from "@/lib/shared/delivery";

export default function PactDetail({ id }: { id: string }) {
  const { refresh } = usePact();
  const [agreement, setAgreement] = useState<AgreementDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const noteError = deliveryNoteError(note);
  const urlError = deliveryUrlError(evidenceUrl);
  const [evidenceFile, setEvidenceFile] = useState<FileDto | null>(null);
  const [score, setScore] = useState("5");
  const [comment, setComment] = useState("");
  const load = useCallback(async () => {
    try {
      const data = await api<{ agreement: AgreementDetailDto }>(
        `/api/agreements/${id}`,
      );
      setAgreement(data.agreement);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar el acuerdo.",
      );
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    void api<{ agreement: AgreementDetailDto }>(`/api/agreements/${id}`)
      .then((data) => {
        if (active) {
          setAgreement(data.agreement);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el acuerdo.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    const update = () => {
      void load();
    };
    return subscribeToChanges(update);
  }, [load]);
  async function action(
    method:
      | "acceptAgreement"
      | "registerDelivery"
      | "approveAndRelease"
      | "cancelAndRefund",
  ) {
    if (!agreement || busy || uploading) return;
    if (method === "registerDelivery" && (noteError || (!evidenceFile && urlError))) {
      setError(noteError ?? urlError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const args =
        method === "registerDelivery"
          ? [
              agreement.chainAgreementId,
              evidenceFile ? fileReference(evidenceFile.id) : evidenceUrl,
              note,
            ]
          : [agreement.chainAgreementId];
      const hash = await sendEscrowAction(
        method,
        args,
        agreement.contractAddress,
      );
      toast.success("Transacción confirmada", {
        description: `El backend actualizará el acuerdo al indexarla. ${hash.slice(0, 10)}…`,
      });
      await api("/api/chain/sync", { method: "POST" });
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function review(release: boolean) {
    if (busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<ReviewOutcomeDto>(
        `/api/agreements/${id}/review`,
        jsonRequest("POST", { release }),
      );
      toast.success(result.message);
      await load();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo revisar la entrega.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!agreement)
    return (
      <div className="card" role={error ? "alert" : "status"}>
        {error ?? "Cargando acuerdo…"}
      </div>
    );
  const status = STATUS_NAMES[agreement.status];
  const isClient = agreement.role === "client";
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Mis acuerdos
      </Link>
      <div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${STATUS_BADGE[status]}`}
        >
          {status}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold">
          {agreement.listingTitle ??
            agreement.description?.split(/[.\n]/)[0]?.slice(0, 80) ??
            "Acuerdo"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Eres {isClient ? "cliente" : "proveedor"} · Contraparte{" "}
          {short(agreement.counterparty.wallet)}
        </p>
      </div>
      {error && (
        <p role="alert" className="card border-warning/40 bg-warning/10">
          {error}
        </p>
      )}
      <section className="card space-y-5 border-2 border-ink">
        <div className="flex items-center gap-4 rounded-2xl bg-ink p-5 text-primary">
          <ShieldCheck className="h-9 w-9" />
          <div>
            <p className="font-display text-3xl font-bold">
              {agreement.amountMon} MON
            </p>
            <p className="text-xs text-ink-foreground">
              {agreement.status === "Approved"
                ? "Liberado al proveedor"
                : agreement.status === "Cancelled"
                  ? "Reembolsado al cliente"
                  : "Bloqueado en escrow"}
            </p>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm">{agreement.description}</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          Vence {new Date(agreement.deadline).toLocaleString("es-CO")}
        </p>
        {agreement.createTx && (
          <a
            href={`${EXPLORER_URL}/tx/${agreement.createTx}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm underline"
          >
            Ver creación en explorer
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </section>
      <AgreementChat
        agreement={agreement}
        onChanged={async () => {
          await Promise.all([load(), refresh()]);
        }}
      />
      {agreement.evidenceUrl && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-bold">
            <FileText className="h-5 w-5" />
            Entrega
          </h2>
          {referencedFileId(agreement.evidenceUrl) ? (
            <FileLink
              id={referencedFileId(agreement.evidenceUrl)!}
              label="Abrir evidencia de la entrega"
            />
          ) : (
            <a
              href={agreement.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm underline"
            >
              {agreement.evidenceUrl}
            </a>
          )}
          <p className="text-sm">{agreement.providerNote}</p>
        </section>
      )}
      {agreement.decisions.map((decision) => (
        <section key={decision.id} className="card space-y-2">
          <h2 className="flex items-center gap-2 font-bold">
            <Sparkles className="h-4 w-4" />
            Revisión: {decision.verdict}
          </h2>
          <p className="text-sm">{decision.summary}</p>
          <p className="break-all text-xs text-muted-foreground">
            Decisión {decision.decisionHash}
          </p>
        </section>
      ))}
      <div className="flex flex-wrap gap-3">
        {!isClient && agreement.status === "Created" && (
          <button
            disabled={busy}
            onClick={() => void action("acceptAgreement")}
            className="btn-primary"
          >
            Aceptar acuerdo
          </button>
        )}
        {isClient && agreement.status === "Created" && (
          <button
            disabled={busy}
            onClick={() => void action("cancelAndRefund")}
            className="btn-secondary"
          >
            Cancelar y reembolsar
          </button>
        )}
        {isClient && agreement.status === "Delivered" && (
          <>
            <button
              disabled={busy}
              onClick={() => void action("approveAndRelease")}
              className="btn-primary"
            >
              Aprobar y liberar {agreement.amountMon} MON
            </button>
            <button
              disabled={busy}
              onClick={() => void review(false)}
              className="btn-secondary"
            >
              Revisar con IA
            </button>
            <button
              disabled={busy}
              onClick={() => void review(true)}
              className="btn-secondary"
            >
              Solicitar liberación al agente
            </button>
          </>
        )}
      </div>
      {!isClient && agreement.status === "Accepted" && (
        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void action("registerDelivery");
          }}
        >
          <h2 className="font-bold">Registrar entrega</h2>
          <label className="block space-y-2 text-sm">
            Enlace a la evidencia
            <input
              required={!evidenceFile}
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full rounded-xl border p-3"
            />
          </label>
          <FileUpload
            purpose="evidence"
            value={evidenceFile}
            onChange={setEvidenceFile}
            onBusyChange={setUploading}
            disabled={busy}
          />
          <label className="block space-y-2 text-sm">
            Nota de entrega
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={!!noteError}
              aria-describedby="delivery-note-help"
              className="w-full rounded-xl border p-3"
            />
            <span
              id="delivery-note-help"
              role={noteError ? "alert" : undefined}
              className={`block text-xs ${noteError ? "text-destructive" : "text-muted-foreground"}`}
            >
              {noteError ??
                `${utf8Length(note)} de ${MAX_DELIVERY_NOTE_BYTES} bytes. Es un resumen que queda en el contrato; los detalles van en el enlace o el archivo.`}
            </span>
          </label>
          <button
            disabled={busy || uploading || !!noteError || (!evidenceFile && !!urlError)}
            className="btn-primary"
          >
            Firmar entrega
          </button>
        </form>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Esperando confirmación…
        </p>
      )}
      {agreement.canRate && (
        <form
          className="workspace-card workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(
                `/api/agreements/${id}/rating`,
                jsonRequest("POST", { score: Number(score), comment }),
              );
              await load();
              toast.success("Valoración guardada");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "No se pudo guardar la valoración.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>¿Cómo fue trabajar juntos?</h2>
          <label>
            Tu valoración
            <select value={score} onChange={(e) => setScore(e.target.value)}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} {value === 1 ? "estrella" : "estrellas"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tu experiencia (opcional)
            <textarea
              maxLength={500}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button className="btn-primary" disabled={busy}>
            Publicar valoración
          </button>
        </form>
      )}
      {agreement.ratings.length > 0 && (
        <section className="workspace-card">
          <h2>Valoraciones del acuerdo</h2>
          {agreement.ratings.map((rating) => (
            <div key={rating.id} className="workspace-divider">
              <strong>
                {rating.score}/5 · Para{" "}
                {rating.rateeRole === "provider"
                  ? "el proveedor"
                  : "el cliente"}
              </strong>
              <p>{rating.comment ?? "Sin comentario"}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
