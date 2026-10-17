"use client";
import { useState } from "react";
import {
  Workspace,
  useResource,
  LoadState,
  Empty,
  messageOf,
} from "@/components/Workspace";
import { api, jsonRequest } from "@/lib/client/api";
import type { AgentKeyDto } from "@/lib/shared/auth";
import type { ProfileDto } from "@/lib/shared/profile";
import {
  WEBHOOK_EVENTS,
  type WebhookEndpointDto,
  type WebhookDeliveryDto,
  type WebhookEventType,
} from "@/lib/shared/webhooks";
export default function Integrations() {
  const keys = useResource<{ keys: AgentKeyDto[] }>("/api/agent-keys");
  const hooks = useResource<{ webhooks: WebhookEndpointDto[] }>(
    "/api/webhooks",
  );
  const profile = useResource<{ profile: ProfileDto }>("/api/profile");
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("30");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deliveries, setDeliveries] = useState<WebhookDeliveryDto[]>([]);
  const [show, setShow] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      title="PACT también trabaja contigo."
      intro="Conecta tus herramientas y automatiza el seguimiento de tus acuerdos."
    >
      <p className="workspace-notice">
        Opcional. Puedes usar PACT sin configurar integraciones. Una clave
        permite actuar como tu cuenta; no autoriza pagos fuera de los límites
        del contrato.
      </p>
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
      {secret && (
        <section className="workspace-card workspace-secret">
          <h2>Guarda este secreto ahora.</h2>
          <p>
            Solo se muestra al crearlo. No lo compartas ni lo incluyas en código
            público.
          </p>
          <code>{secret}</code>
          <div className="workspace-actions">
            <button
              className="btn-secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(secret)
                  .then(() => setNotice("Secreto copiado."))
                  .catch(() =>
                    setError(
                      "No se pudo copiar. Selecciona el texto y cópialo manualmente.",
                    ),
                  )
              }
            >
              Copiar
            </button>
            <button className="btn-secondary" onClick={() => setSecret("")}>
              Ya lo guardé
            </button>
          </div>
        </section>
      )}
      <div className="workspace-split">
        <section className="workspace-card">
          <h2>Claves de agente</h2>
          <LoadState {...keys} retry={keys.reload} />
          <LoadState {...profile} retry={profile.reload} />
          {profile.data && !profile.data.profile.isAgent ? (
            <>
              <p>Activa el perfil de agente para crear claves.</p>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(
                      "/api/profile",
                      jsonRequest("PUT", { isAgent: true }),
                    );
                    await profile.reload();
                  })
                }
              >
                Activar perfil de agente
              </button>
            </>
          ) : (
            <form
              className="workspace-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const result = await api<{ key: string }>(
                    "/api/agent-keys",
                    jsonRequest("POST", {
                      name,
                      expiresInDays: Number(expires),
                    }),
                  );
                  setSecret(result.key);
                  setName("");
                  await keys.reload();
                });
              }}
            >
              <label>
                Nombre de la integración
                <input
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Validez en días
                <input
                  type="number"
                  required
                  min="1"
                  max="365"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </label>
              <button className="btn-primary" disabled={busy || !!secret}>
                Crear clave
              </button>
            </form>
          )}
          {keys.data?.keys.map((key) => (
            <div className="workspace-divider" key={key.id}>
              <strong>{key.name}</strong>
              <p>
                <code>{key.prefix}…</code> ·{" "}
                {key.revokedAt
                  ? "Revocada"
                  : key.expiresAt && new Date(key.expiresAt) < new Date()
                    ? "Vencida"
                    : "Activa"}
              </p>
              {!key.revokedAt &&
                (confirm === key.id ? (
                  <div className="workspace-actions">
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api(`/api/agent-keys/${key.id}`, {
                            method: "DELETE",
                          });
                          setConfirm("");
                          await keys.reload();
                        })
                      }
                    >
                      Confirmar revocación
                    </button>
                    <button onClick={() => setConfirm("")}>Conservar</button>
                  </div>
                ) : (
                  <button
                    className="workspace-text-button"
                    onClick={() => setConfirm(key.id)}
                  >
                    Revocar clave
                  </button>
                ))}
            </div>
          ))}
        </section>
        <section className="workspace-card">
          <h2>Avisos a tus herramientas</h2>
          <p>PACT envía los eventos a una URL HTTPS que controles.</p>
          <LoadState {...hooks} retry={hooks.reload} />
          <form
            className="workspace-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await api<{ secret: string }>(
                  "/api/webhooks",
                  jsonRequest("POST", { url, events }),
                );
                setSecret(result.secret);
                setUrl("");
                await hooks.reload();
              });
            }}
          >
            <label>
              URL de recepción
              <input
                type="url"
                required
                pattern="https://.*"
                maxLength={512}
                placeholder="https://tu-servicio.com/avisos"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <fieldset className="workspace-event-list">
              <legend>Eventos (sin selección, todos)</legend>
              {WEBHOOK_EVENTS.filter((e) => e !== "ping").map((event) => (
                <label key={event}>
                  <input
                    type="checkbox"
                    checked={events.includes(event)}
                    onChange={(e) =>
                      setEvents(
                        e.target.checked
                          ? [...events, event]
                          : events.filter((v) => v !== event),
                      )
                    }
                  />
                  {event}
                </label>
              ))}
            </fieldset>
            <button className="btn-primary" disabled={busy || !!secret}>
              Conectar avisos
            </button>
          </form>
          {hooks.data?.webhooks.map((hook) => (
            <div key={hook.id} className="workspace-divider">
              <p className="workspace-code">{hook.url}</p>
              <p>
                {hook.active ? "Activo" : "Pausado"} ·{" "}
                {hook.consecutiveFailures} fallos consecutivos
              </p>
              <div className="workspace-actions">
                <button
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() =>
                    void run(async () => {
                      await api(
                        `/api/webhooks/${hook.id}`,
                        jsonRequest("PATCH", { active: !hook.active }),
                      );
                      await hooks.reload();
                    })
                  }
                >
                  {hook.active ? "Pausar" : "Reactivar"}
                </button>
                <button
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() =>
                    void run(async () => {
                      await api(`/api/webhooks/${hook.id}/test`, {
                        method: "POST",
                      });
                      setNotice(
                        "Prueba encolada. Se enviará al ejecutar el worker.",
                      );
                    })
                  }
                >
                  Enviar prueba
                </button>
                <button
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{ deliveries: WebhookDeliveryDto[] }>(
                        `/api/webhooks/${hook.id}/deliveries`,
                      );
                      setDeliveries(r.deliveries);
                      setShow(hook.id);
                    })
                  }
                >
                  Ver entregas
                </button>
              </div>
              {confirm === hook.id ? (
                <div className="workspace-actions">
                  <button
                    className="btn-secondary"
                    disabled={busy || !!secret}
                    onClick={() =>
                      void run(async () => {
                        const r = await api<{ secret: string }>(
                          `/api/webhooks/${hook.id}/rotate-secret`,
                          { method: "POST" },
                        );
                        setSecret(r.secret);
                        setConfirm("");
                      })
                    }
                  >
                    Confirmar nuevo secreto
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(`/api/webhooks/${hook.id}`, {
                          method: "DELETE",
                        });
                        setConfirm("");
                        await hooks.reload();
                      })
                    }
                  >
                    Confirmar eliminación
                  </button>
                  <button onClick={() => setConfirm("")}>Cancelar</button>
                </div>
              ) : (
                <button
                  className="workspace-text-button"
                  onClick={() => setConfirm(hook.id)}
                >
                  Cambiar secreto o eliminar
                </button>
              )}
              {show === hook.id && (
                <div className="workspace-deliveries">
                  {deliveries.map((d) => (
                    <p key={d.id}>
                      {d.event} · {d.status} · intento {d.attempts}
                      {d.lastError ? ` · ${d.lastError}` : ""}
                    </p>
                  ))}
                  {!deliveries.length && (
                    <Empty>Aún no hay avisos enviados.</Empty>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </Workspace>
  );
}
