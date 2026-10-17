"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workspace,
  useResource,
  LoadState,
  Empty,
  Metric,
  messageOf,
} from "@/components/Workspace";
import { FileLink } from "@/components/FileUpload";
import { api, jsonRequest } from "@/lib/client/api";
import {
  fundSelectedAgreement,
  fundingTransactionState,
} from "@/lib/client/marketplace-wallet";
import { usePact } from "@/lib/client/pact-context";
import { EXPLORER_URL } from "@/lib/shared/chain";
import type { SessionUser } from "@/lib/shared/auth";
import type {
  ListingDto,
  ApplicationDto,
  SelectionResultDto,
  CreateAgreementParams,
  ScreeningDto,
} from "@/lib/shared/listings";

export default function ListingDetail({ id }: { id: string }) {
  const state = useResource<{ listing: ListingDto }>(`/api/listings/${id}`);
  const session = useResource<{ user: SessionUser }>("/api/auth/me");
  const router = useRouter();
  const { connectWallet, connected, refresh, changes } = usePact();
  const listing = state.data?.listing;
  const owner = !!listing && listing.clientId === session.data?.user.id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [applications, setApplications] = useState<ApplicationDto[]>([]);
  const [appsError, setAppsError] = useState("");
  const [call, setCall] = useState<CreateAgreementParams | null>(null);
  const [txHash, setTxHash] = useState("");
  const [checked, setChecked] = useState(false);
  const [candidate, setCandidate] = useState<ApplicationDto | null>(null);
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  useEffect(() => {
    if (!owner) return;
    let active = true;
    void api<{ applications: ApplicationDto[] }>(
      `/api/listings/${id}/applications`,
    )
      .then((r) => {
        if (active) {
          setApplications(r.applications);
          setAppsError("");
        }
      })
      .catch((e) => {
        if (active) setAppsError(messageOf(e));
      });
    return () => {
      active = false;
    };
  }, [id, owner, listing?.status, changes]);
  async function perform(run: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function reloadApps() {
    const r = await api<{ applications: ApplicationDto[] }>(
      `/api/listings/${id}/applications`,
    );
    setApplications(r.applications);
    setAppsError("");
  }
  async function act(app: ApplicationDto, action: string, confirmed = false) {
    if (action === "select" && !confirmed) {
      setCandidate(app);
      return;
    }
    await perform(async () => {
      if (action === "select" && !connected) await connectWallet();
      const r = await api<{ selection: SelectionResultDto | null }>(
        `/api/applications/${app.id}`,
        jsonRequest("PATCH", { action }),
      );
      if (r.selection) setCall(r.selection.contractCall);
      setCandidate(null);
      await state.reload();
      await reloadApps();
    });
  }
  useEffect(() => {
    if (!owner || listing?.status !== "awarded") return;
    const controller = new AbortController();
    void api<{ contractCall: CreateAgreementParams }>(
      `/api/listings/${id}/selection`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setCall(result.contractCall);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(messageOf(e));
      });
    return () => controller.abort();
  }, [id, owner, listing?.status]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        setTxHash(sessionStorage.getItem(`pact:funded:${id}`) ?? "");
      } catch {
        /* Storage is optional. */
      }
    });
    return () => {
      active = false;
    };
  }, [id]);
  const funding = call;
  return (
    <Workspace
      title={listing?.title ?? "Oportunidad"}
      intro="Condiciones claras para empezar con confianza."
    >
      <LoadState {...state} retry={state.reload} />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="workspace-notice">
          {notice}
        </p>
      )}
      {candidate && (
        <section
          className="workspace-card workspace-funding"
          role="region"
          aria-label="Confirmar proveedor"
        >
          <h2>
            ¿Trabajamos con{" "}
            {candidate.provider.displayName ??
              candidate.provider.username ??
              "este proveedor"}
            ?
          </h2>
          <p>
            {candidate.priceMon ?? listing?.budgetMon} MON ·{" "}
            {candidate.days ?? listing?.deadlineDays} días
          </p>
          <p>
            Al confirmar se elige esta propuesta y se descartan las demás.
            Todavía no se bloquean fondos.
          </p>
          <div className="workspace-actions">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => void act(candidate, "select", true)}
            >
              Confirmar proveedor
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setCandidate(null)}
            >
              Seguir comparando
            </button>
          </div>
        </section>
      )}
      {listing && (
        <>
          <div className="workspace-split">
            <section className="workspace-card">
              <span className="workspace-pill">
                {listing.status === "draft"
                  ? "Borrador"
                  : listing.status === "open"
                    ? "Recibe propuestas"
                    : listing.status === "awarded"
                      ? "Proveedor elegido"
                      : "Cerrada"}
              </span>
              <p className="workspace-description">
                {listing.description ?? "Revisa el brief adjunto."}
              </p>
              <div className="workspace-metrics">
                <Metric
                  value={`${listing.budgetMon ?? "Por definir"} MON`}
                  label="Presupuesto"
                />
                <Metric
                  value={
                    listing.deadlineDays
                      ? `${listing.deadlineDays} días`
                      : "Por definir"
                  }
                  label="Entrega"
                />
              </div>
              {listing.briefFileId && (
                <FileLink id={listing.briefFileId} label="Abrir brief" />
              )}
              <div className="skill-tags">
                {listing.keywords.map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </div>
              <h2>Condiciones de aceptación</h2>
              {listing.rules?.length ? (
                <ol className="workspace-rules">
                  {listing.rules.map((rule) => (
                    <li key={rule.position}>
                      {rule.criterion}
                      <small>Peso {rule.weight}/5</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  El cliente debe completar las condiciones antes de publicar.
                </p>
              )}
            </section>
            <aside className="workspace-card workspace-aside">
              <h2>Próximo paso</h2>
              {owner ? (
                <>
                  <p>
                    {listing.status === "draft"
                      ? "Revisa las condiciones y publica para recibir propuestas."
                      : listing.status === "awarded"
                        ? "Revisa la propuesta seleccionada y bloquea los fondos desde tu wallet."
                        : "Compara las propuestas y elige a tu proveedor."}
                  </p>
                  <Link href="/solicitudes">Ver mis solicitudes</Link>
                  {["draft", "open", "selecting"].includes(listing.status) && (
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await api(`/api/listings/${id}/close`, {
                            method: "POST",
                          });
                          await state.reload();
                        })
                      }
                    >
                      Cerrar oportunidad
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Publicada por{" "}
                    {listing.clientName ??
                      listing.clientUsername ??
                      "Cliente PACT"}
                    .
                  </p>
                  <Link
                    href={`/personas/${listing.clientUsername ?? listing.clientId}`}
                  >
                    Ver perfil del cliente
                  </Link>
                  {!session.data && (
                    <Link className="btn-primary" href="/iniciar-sesion">
                      Iniciar sesión para postularme
                    </Link>
                  )}
                </>
              )}
            </aside>
          </div>
          {owner && listing.status === "draft" && (
            <ListingEditor
              listing={listing}
              onSaved={() => void state.reload()}
            />
          )}
          {!owner &&
            session.data &&
            listing.status === "open" &&
            !listing.myApplication && (
              <form
                className="workspace-card workspace-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await api(
                      `/api/listings/${id}/applications`,
                      jsonRequest("POST", {
                        message,
                        ...(price ? { priceMon: Number(price) } : {}),
                        ...(days ? { days: Number(days) } : {}),
                      }),
                    );
                    await state.reload();
                    setNotice(
                      "Propuesta enviada. Puedes seguirla en Postulaciones.",
                    );
                  });
                }}
              >
                <h2>Cuéntale cómo lo harías.</h2>
                <label htmlFor="proposal">Tu propuesta</label>
                <textarea
                  id="proposal"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="workspace-fields">
                  <label>
                    Precio propuesto en MON (opcional)
                    <input
                      type="number"
                      min="0.000001"
                      max="5000000"
                      step="0.000001"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </label>
                  <label>
                    Plazo en días (opcional)
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                    />
                  </label>
                </div>
                <button className="btn-primary" disabled={busy}>
                  {busy ? "Enviando…" : "Enviar propuesta"}
                </button>
              </form>
            )}
          {!owner && listing.myApplication && (
            <p className="workspace-notice">
              Ya enviaste una propuesta.{" "}
              <Link href="/postulaciones">Ver su estado</Link>
            </p>
          )}
          {owner && listing.status !== "draft" && (
            <section>
              <div className="workspace-toolbar">
                <h2>Propuestas recibidas</h2>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void perform(reloadApps)}
                >
                  Actualizar
                </button>
              </div>
              {appsError && (
                <p role="alert" className="auth-error">
                  {appsError}
                </p>
              )}
              <div className="workspace-grid">
                {applications.map((app) => (
                  <article className="workspace-card" key={app.id}>
                    <Link
                      href={`/personas/${app.provider.username ?? app.providerId}`}
                    >
                      <h2>
                        {app.provider.displayName ??
                          app.provider.username ??
                          "Profesional PACT"}
                      </h2>
                    </Link>
                    <span className="workspace-pill">
                      {
                        {
                          submitted: "Enviada",
                          shortlisted: "Preseleccionada",
                          selected: "Seleccionada",
                          rejected: "Descartada",
                          withdrawn: "Retirada",
                        }[app.status]
                      }
                    </span>
                    <p>{app.message}</p>
                    <div className="workspace-metrics">
                      <Metric
                        value={`${app.priceMon ?? listing.budgetMon} MON`}
                        label="Propuesta"
                      />
                      <Metric
                        value={`${app.days ?? listing.deadlineDays} días`}
                        label="Plazo"
                      />
                    </div>
                    {app.screening && <ScreeningNote screening={app.screening} />}
                    {app.match && (
                      <p className="field-help">
                        Encaje {Math.round(app.match.breakdown.total)}/100 ·{" "}
                        {app.match.reasons.join(" · ")}
                      </p>
                    )}
                    <div className="workspace-actions">
                      {listing.status === "open" &&
                        ["submitted", "shortlisted"].includes(app.status) && (
                          <>
                            {app.status === "submitted" && (
                              <button
                                className="btn-secondary"
                                disabled={busy}
                                onClick={() => void act(app, "shortlist")}
                              >
                                Preseleccionar
                              </button>
                            )}
                            <button
                              className="btn-secondary"
                              disabled={busy}
                              onClick={() => void act(app, "reject")}
                            >
                              Descartar
                            </button>
                            <button
                              className="btn-primary"
                              disabled={busy || !app.provider.wallet}
                              onClick={() => void act(app, "select")}
                            >
                              Elegir proveedor
                            </button>
                            {!app.provider.wallet && (
                              <p className="field-help">
                                El proveedor debe vincular una wallet para
                                recibir el pago.
                              </p>
                            )}
                          </>
                        )}
                    </div>
                  </article>
                ))}
              </div>
              {!applications.length && !appsError && (
                <Empty>
                  Aún no hay propuestas. Comparte esta oportunidad para
                  encontrar talento.
                </Empty>
              )}
            </section>
          )}
          {owner && listing.status === "awarded" && funding && (
            <section className="workspace-card workspace-funding">
              <h2>Confirma y bloquea los fondos.</h2>
              <p>
                Proveedor: <code>{funding.provider}</code>
              </p>
              <p>
                {funding.amountMon} MON · {funding.deadlineDays} días
              </p>
              <p>
                Esta acción crea el acuerdo y bloquea MON en el contrato. La
                wallet mostrará la operación antes de firmar.
              </p>
              <label className="workspace-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                Revisé el proveedor, el monto y las condiciones.
              </label>
              {txHash ? (
                <>
                  <a
                    href={`${EXPLORER_URL}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver transacción enviada
                  </a>
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        const status = await fundingTransactionState(txHash);
                        if (status === "pending")
                          throw new Error(
                            "La transacción sigue pendiente. Espera la confirmación antes de continuar.",
                          );
                        if (status === "failed") {
                          setTxHash("");
                          sessionStorage.removeItem(`pact:funded:${id}`);
                          setNotice(
                            "La transacción fue revertida. Puedes revisar y volver a firmar.",
                          );
                          return;
                        }
                        await api("/api/chain/sync", { method: "POST" });
                        await refresh();
                        router.push("/dashboard");
                      })
                    }
                  >
                    Actualizar mis acuerdos
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary"
                  disabled={busy || !checked}
                  onClick={() =>
                    void perform(async () => {
                      if (!connected) await connectWallet();
                      const latest = await api<{
                        contractCall: CreateAgreementParams;
                      }>(`/api/listings/${id}/selection`);
                      if (
                        (
                          [
                            "provider",
                            "description",
                            "deadlineDays",
                            "rulesHash",
                            "amountMon",
                          ] as const
                        ).some(
                          (key) => latest.contractCall[key] !== funding[key],
                        )
                      ) {
                        setCall(latest.contractCall);
                        setChecked(false);
                        throw new Error(
                          "Las condiciones cambiaron. Revisa de nuevo antes de firmar.",
                        );
                      }
                      await fundSelectedAgreement(
                        latest.contractCall,
                        (hash) => {
                          setTxHash(hash);
                          try {
                            sessionStorage.setItem(`pact:funded:${id}`, hash);
                          } catch {
                            /* Optional browser persistence. */
                          }
                        },
                      );
                      await api("/api/chain/sync", { method: "POST" });
                      await refresh();
                      router.push("/dashboard");
                    })
                  }
                >
                  {busy
                    ? "Esperando confirmación…"
                    : `Crear acuerdo y bloquear ${funding.amountMon} MON`}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </Workspace>
  );
}
const splitKeywords = (value: string) =>
  [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

const VERDICT_LABEL = {
  accept: "La IA recomienda aceptarla",
  review: "La IA sugiere revisarla",
  reject: "La IA recomienda descartarla",
} as const;

function ScreeningNote({ screening }: { screening: ScreeningDto }) {
  return (
    <div className={`screening-note screening-${screening.verdict}`}>
      <p className="screening-title">
        {VERDICT_LABEL[screening.verdict]} · {screening.score}/100
      </p>
      <p>{screening.summary}</p>
      {screening.strengths.length > 0 && (
        <ul>
          {screening.strengths.map((item) => (
            <li key={item}>+ {item}</li>
          ))}
        </ul>
      )}
      {screening.concerns.length > 0 && (
        <ul>
          {screening.concerns.map((item) => (
            <li key={item}>− {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingEditor({
  listing,
  onSaved,
}: {
  listing: ListingDto;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? "");
  const [amount, setAmount] = useState(listing.budgetMon ?? "");
  const [days, setDays] = useState(String(listing.deadlineDays ?? ""));
  const [keywords, setKeywords] = useState(listing.keywords.join(", "));
  const [rules, setRules] = useState(
    listing.rules?.map((r) => r.criterion).join("\n") ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function saveDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(
        `/api/listings/${listing.id}`,
        jsonRequest("PATCH", {
          title,
          ...(description.trim() ? { description } : {}),
          ...(amount ? { budgetMon: Number(amount) } : {}),
          ...(days ? { deadlineDays: Number(days) } : {}),
          keywords: splitKeywords(keywords),
        }),
      );
      const criteria = rules
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
      if (criteria.length)
        await api(
          `/api/listings/${listing.id}/rules`,
          jsonRequest("PUT", {
            rules: criteria.map((criterion) => ({
              criterion,
              weight:
                listing.rules?.find((r) => r.criterion === criterion)?.weight ??
                3,
            })),
          }),
        );
      setNotice("Borrador guardado.");
      onSaved();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="workspace-card workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const criteria = rules
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean);
          if (
            criteria.length < 1 ||
            criteria.length > 12 ||
            criteria.some((r) => r.length < 5 || r.length > 300)
          )
            throw new Error(
              "Escribe de 1 a 12 condiciones, de 5 a 300 caracteres cada una.",
            );
          await api(
            `/api/listings/${listing.id}`,
            jsonRequest("PATCH", {
              title,
              description,
              budgetMon: Number(amount),
              deadlineDays: Number(days),
              keywords: splitKeywords(keywords),
            }),
          );
          await api(
            `/api/listings/${listing.id}/rules`,
            jsonRequest("PUT", {
              rules: criteria.map((criterion) => ({
                criterion,
                weight:
                  listing.rules?.find((rule) => rule.criterion === criterion)
                    ?.weight ?? 3,
              })),
            }),
          );
          await api(`/api/listings/${listing.id}/publish`, { method: "POST" });
          onSaved();
        } catch (e) {
          setError(messageOf(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Revisa antes de publicar.</h2>
      <label>
        Título
        <input
          required
          minLength={3}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Descripción
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={16}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Palabras clave (separadas por comas)
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="backend, api rest, node.js, postgresql"
        />
        <span className="field-help">
          Con ellas avisamos primero a quienes tienen esas habilidades. Si las
          dejas vacías, las tomamos de tu texto.
        </span>
        {splitKeywords(keywords).length > 0 && (
          <span className="keyword-chips">
            {splitKeywords(keywords).map((keyword) => (
              <span className="workspace-pill" key={keyword}>
                {keyword}
              </span>
            ))}
          </span>
        )}
      </label>
      <div className="workspace-fields">
        <label>
          Presupuesto en MON
          <input
            type="number"
            required
            min="0.000001"
            max="5000000"
            step="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Plazo en días
          <input
            type="number"
            required
            min="1"
            max="365"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
      </div>
      <label>
        Condiciones de aceptación (una por línea)
        <textarea
          required
          rows={5}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="Entrega los archivos editables y exportados…"
        />
      </label>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="workspace-notice">
          {notice}
        </p>
      )}
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={() => void saveDraft()}
      >
        Guardar borrador
      </button>
      <button className="btn-primary" disabled={busy}>
        {busy ? "Publicando…" : "Confirmar condiciones y publicar"}
      </button>
      <p className="field-help">
        Las condiciones no se pueden editar una vez publicada la oportunidad.
      </p>
    </form>
  );
}
