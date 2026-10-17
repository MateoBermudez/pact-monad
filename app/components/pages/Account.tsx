"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Workspace,
  useResource,
  LoadState,
  messageOf,
} from "@/components/Workspace";
import { api, jsonRequest } from "@/lib/client/api";
import { oauthStartUrl, signOut } from "@/lib/client/auth";
import type { IdentityDto } from "@/lib/shared/auth";
import type { ProfileDto, Availability } from "@/lib/shared/profile";
import { usePact } from "@/lib/client/pact-context";
import { ProfileSkills } from "@/components/ProfileSkills";
export default function Account() {
  const params = useSearchParams();
  const state = useResource<{ profile: ProfileDto }>("/api/profile");
  const identities = useResource<{ identities: IdentityDto[] }>(
    "/api/auth/identities",
  );
  const { connected, connectWallet } = usePact();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Workspace
      title="Tu cuenta, a tu manera."
      intro="Presenta tu trabajo y gestiona cómo accedes a PACT."
    >
      <LoadState {...state} retry={state.reload} />
      {params.has("auth_error") && (
        <p role="alert" className="auth-error">
          No se pudo vincular esa cuenta de acceso. Vuelve a intentarlo o elige
          otra cuenta.
        </p>
      )}
      {state.data && (
        <div className="workspace-split">
          <ProfileFields
            key={state.data.profile.id}
            profile={state.data.profile}
            onSaved={() => void state.reload()}
          />
          <div className="workspace-list">
            <section className="workspace-card">
              <h2>Tu wallet</h2>
              <p className="workspace-code">
                {state.data.profile.wallet ??
                  "Aún no has vinculado una wallet."}
              </p>
              <p>
                La dirección se verifica con una firma y se usa para tus
                transacciones.
              </p>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await connectWallet();
                    await state.reload();
                    setNotice("Wallet verificada y conectada.");
                  } catch (e) {
                    setError(messageOf(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Verificando…"
                  : connected
                    ? "Verificar wallet"
                    : "Conectar MetaMask"}
              </button>
            </section>
            <section className="workspace-card">
              <h2>Formas de acceso</h2>
              <LoadState {...identities} retry={identities.reload} />
              {identities.data?.identities.map((i) => (
                <p key={i.provider}>
                  <strong>
                    {i.provider === "google" ? "Google" : "GitHub"}
                  </strong>{" "}
                  · {i.email ?? "Cuenta vinculada"}
                </p>
              ))}
              {identities.data &&
                (["google", "github"] as const)
                  .filter(
                    (p) =>
                      !identities.data?.identities.some(
                        (i) => i.provider === p,
                      ),
                  )
                  .map((provider) => (
                    <a
                      className="btn-secondary"
                      key={provider}
                      href={oauthStartUrl(provider, {
                        link: true,
                        next: "/cuenta",
                      })}
                    >
                      Vincular {provider === "google" ? "Google" : "GitHub"}
                    </a>
                  ))}
            </section>
            <section className="workspace-card">
              <h2>Más de tu perfil</h2>
              <Link className="workspace-link" href="/perfil">
                Nombre de usuario y habilidades ↗
              </Link>
              <Link className="workspace-link" href="/portafolio">
                Gestionar portafolio ↗
              </Link>
              <Link
                className="workspace-link"
                href={`/personas/${state.data.profile.username ?? state.data.profile.id}`}
              >
                Ver perfil público ↗
              </Link>
              <Link className="workspace-link" href="/integraciones">
                Integraciones y agentes ↗
              </Link>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await signOut();
                    window.location.reload();
                  } catch (e) {
                    setError(messageOf(e));
                    setBusy(false);
                  }
                }}
              >
                Cerrar sesión
              </button>
            </section>
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
          </div>
        </div>
      )}
    </Workspace>
  );
}
function ProfileFields({
  profile,
  onSaved,
}: {
  profile: ProfileDto;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.displayName ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [availability, setAvailability] = useState<Availability>(
    profile.availability,
  );
  const [avatar, setAvatar] = useState(profile.avatarUrl ?? "");
  const [links, setLinks] = useState(profile.links);
  const [skills, setSkills] = useState(profile.skills);
  const [keywords, setKeywords] = useState(profile.keywords);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="workspace-card workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setFeedback("");
        try {
          await api(
            "/api/profile",
            jsonRequest("PUT", {
              displayName: name || null,
              headline,
              bio,
              location,
              availability,
              avatarUrl: avatar || null,
              links,
              skills: skills.map(({ slug, level }) => ({ slug, level })),
              keywords,
            }),
          );
          setFeedback("Perfil actualizado.");
          onSaved();
        } catch (e) {
          setError(messageOf(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Cómo te ven</h2>
      <label>
        Nombre público
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
      </label>
      <label>
        A qué te dedicas
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={120}
        />
      </label>
      <ProfileSkills
        skills={skills}
        keywords={keywords}
        onSkillsChange={setSkills}
        onKeywordsChange={setKeywords}
        disabled={busy}
      />
      <label>
        Sobre ti
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={1000}
          rows={5}
        />
      </label>
      <label>
        Ubicación
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={80}
        />
      </label>
      <label>
        Disponibilidad
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value as Availability)}
        >
          <option value="available">Disponible</option>
          <option value="busy">Ocupado</option>
          <option value="unavailable">No disponible</option>
        </select>
      </label>
      <label>
        URL de tu avatar (HTTPS)
        <input
          type="url"
          pattern="https://.*"
          value={avatar}
          maxLength={512}
          onChange={(e) => setAvatar(e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Tus enlaces</legend>
        {links.map((link, index) => (
          <div className="workspace-fields" key={index}>
            <label>
              Nombre del enlace
              <input
                required
                maxLength={30}
                value={link.label}
                onChange={(e) =>
                  setLinks(
                    links.map((l, i) =>
                      i === index ? { ...l, label: e.target.value } : l,
                    ),
                  )
                }
              />
            </label>
            <label>
              Dirección
              <input
                required
                type="url"
                maxLength={512}
                value={link.url}
                onChange={(e) =>
                  setLinks(
                    links.map((l, i) =>
                      i === index ? { ...l, url: e.target.value } : l,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="workspace-text-button"
              onClick={() => setLinks(links.filter((_, i) => i !== index))}
            >
              Quitar enlace
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          disabled={links.length >= 5}
          onClick={() => setLinks([...links, { label: "", url: "" }])}
        >
          Añadir enlace
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="workspace-notice">
          {feedback}
        </p>
      )}
      <button disabled={busy} className="btn-primary">
        {busy ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}
