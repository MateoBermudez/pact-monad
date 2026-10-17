"use client";
import { useState } from "react";
import {
  Workspace,
  useResource,
  LoadState,
  Empty,
  messageOf,
} from "@/components/Workspace";
import { FileUpload, FileLink } from "@/components/FileUpload";
import { api, jsonRequest } from "@/lib/client/api";
import type { FileDto } from "@/lib/shared/files";
import type { PortfolioItemDto, PublicProfileDto } from "@/lib/shared/profile";
import Link from "next/link";
export function Portfolio() {
  const state = useResource<{ items: PortfolioItemDto[] }>("/api/portfolio");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<FileDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState("");
  return (
    <Workspace
      title="Que tu trabajo hable por ti."
      intro="Reúne los proyectos que muestran lo que sabes hacer."
    >
      <LoadState {...state} retry={state.reload} />
      <div className="workspace-split">
        <section>
          <h2 className="workspace-section-title">Tus proyectos</h2>
          <div className="workspace-list">
            {state.data?.items.map((item) => (
              <article className="workspace-card" key={item.id}>
                <PortfolioItem item={item} />
                {remove === item.id ? (
                  <div className="workspace-actions">
                    <p>¿Quitar este proyecto del portafolio?</p>
                    <button
                      disabled={busy}
                      className="btn-secondary"
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await api(`/api/portfolio/${item.id}`, {
                            method: "DELETE",
                          });
                          await state.reload();
                          setRemove("");
                        } catch (e) {
                          setError(messageOf(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Sí, quitar
                    </button>
                    <button
                      onClick={() => setRemove("")}
                      className="btn-secondary"
                    >
                      Conservar
                    </button>
                  </div>
                ) : (
                  <button
                    className="workspace-text-button"
                    onClick={() => setRemove(item.id)}
                  >
                    Quitar proyecto
                  </button>
                )}
              </article>
            ))}
          </div>
          {state.data?.items.length === 0 && (
            <Empty>
              Tu primer proyecto empieza a contar tu historia. Añádelo aquí.
            </Empty>
          )}
        </section>
        <form
          className="workspace-card workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api(
                "/api/portfolio",
                jsonRequest("POST", {
                  title,
                  ...(description ? { description } : {}),
                  ...(url ? { url } : {}),
                  ...(file ? { fileId: file.id } : {}),
                  tags: tags
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }),
              );
              setTitle("");
              setDescription("");
              setUrl("");
              setTags("");
              setFile(null);
              await state.reload();
            } catch (e) {
              setError(messageOf(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Añade un proyecto</h2>
          <label>
            Título
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Qué hiciste
            <textarea
              maxLength={1000}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Enlace (opcional)
            <input
              type="url"
              maxLength={512}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <FileUpload
            purpose="portfolio"
            value={file}
            onChange={setFile}
            onBusyChange={setUploading}
            disabled={busy}
          />
          <label>
            Etiquetas, separadas por comas
            <input
              maxLength={500}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
          <p className="field-help">
            Los proyectos y sus archivos serán públicos en tu perfil.
          </p>
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          <button
            className="btn-primary"
            disabled={
              busy || uploading || (!file && !description.trim() && !url)
            }
          >
            {busy ? "Guardando…" : "Publicar proyecto"}
          </button>
        </form>
      </div>
    </Workspace>
  );
}
export function PortfolioItem({ item }: { item: PortfolioItemDto }) {
  return (
    <>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      {item.url && (
        <a
          className="workspace-link"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          Ver proyecto ↗
        </a>
      )}
      {item.fileId && <FileLink id={item.fileId} />}
      <div className="skill-tags">
        {item.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </>
  );
}
export function PublicProfile({ id }: { id: string }) {
  const state = useResource<{ profile: PublicProfileDto }>(
    `/api/users/${encodeURIComponent(id)}`,
  );
  const profile = state.data?.profile;
  return (
    <Workspace
      title={
        profile?.displayName ??
        (profile?.username ? `@${profile.username}` : "Conoce su trabajo.")
      }
      intro={profile?.headline ?? "Talento, experiencia y acuerdos cumplidos."}
    >
      <LoadState {...state} retry={state.reload} />
      {profile && (
        <>
          <section className="workspace-banner">
            <div>
              <span>@{profile.username ?? "sin_nombre"}</span>
              <h2>{profile.location ?? "Talento sin fronteras"}</h2>
              <p>
                {profile.bio ?? "Este perfil aún no tiene una presentación."}
              </p>
              <div className="skill-tags">
                {profile.skills.map((skill) => (
                  <span key={skill.slug}>
                    {skill.name} · nivel {skill.level}/5
                  </span>
                ))}
              </div>
            </div>
            <div>
              <strong className="workspace-big-number">
                {profile.reputation.providerAverage?.toFixed(1) ?? "—"}
              </strong>
              <p>{profile.reputation.providerRatings} valoraciones</p>
              <p>
                {profile.reputation.completedAsProvider} trabajos completados
              </p>
            </div>
          </section>
          <div className="workspace-toolbar">
            <h2>Portafolio</h2>
            {profile.wallet ? (
              <Link
                className="btn-primary"
                href={`/crear?provider=${encodeURIComponent(profile.wallet)}`}
              >
                Crear acuerdo con esta persona
              </Link>
            ) : (
              <span className="field-help">
                Aún no ha vinculado una wallet para recibir pagos.
              </span>
            )}
          </div>
          <div className="workspace-grid">
            {profile.portfolio.map((item) => (
              <article className="workspace-card" key={item.id}>
                <PortfolioItem item={item} />
              </article>
            ))}
          </div>
          {!profile.portfolio.length && (
            <Empty>Aún no hay proyectos publicados en este perfil.</Empty>
          )}
          <div className="workspace-card">
            <h2>Enlaces</h2>
            {profile.links.map((link) => (
              <a
                className="workspace-link"
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.label} ↗
              </a>
            ))}
            {!profile.links.length && <p>No ha añadido enlaces.</p>}
          </div>
        </>
      )}
    </Workspace>
  );
}
