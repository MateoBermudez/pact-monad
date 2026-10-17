"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Laptop,
  Search,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { api, jsonRequest } from "@/lib/client/api";
import type { Role } from "@/lib/shared/auth";
import type { ProfileDto, SkillDto } from "@/lib/shared/profile";
import { AvatarUpload } from "./AvatarUpload";
import { ProfileAvatar } from "./ProfileAvatar";

const roles = [
  "Cliente",
  "Prestador de servicios",
  "Cliente y prestador",
] as const;
const ROLES_BY_LABEL: Record<(typeof roles)[number], Role[]> = {
  Cliente: ["client"],
  "Prestador de servicios": ["provider"],
  "Cliente y prestador": ["client", "provider"],
};
const roleLabelFor = (value: Role[]): (typeof roles)[number] => {
  if (value.length === 2) return roles[2];
  return value[0] === "client" ? roles[0] : value[0] === "provider" ? roles[1] : roles[2];
};
const offersServices = (label: string) => ROLES_BY_LABEL[label as (typeof roles)[number]]?.includes("provider") ?? true;
type Profile = ProfileDto & { username?: string | null };
type Availability = { available: boolean; message: string | null };
export function ProfileSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fixedName, setFixedName] = useState(false);
  const [catalog, setCatalog] = useState<SkillDto[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>(roles[2]);
  const [status, setStatus] = useState("");
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ skills: SkillDto[] }>("/api/skills")
      .then((data) => {
        if (active) setCatalog(data.skills);
      })
      .catch(() => {
        if (active)
          setError(
            "No pudimos cargar el catálogo. Puedes escribir tus habilidades y guardarlas como palabras clave.",
          );
      });
    void api<{ profile: Profile }>("/api/profile")
      .then(({ profile }) => {
        if (!active) return;
        setAuthenticated(true);
        setAvatar(profile.avatarUrl ?? "");
        setLevels(
          Object.fromEntries(
            profile.skills.map((skill) => [skill.slug, skill.level]),
          ),
        );
        setName(profile.username ?? "");
        setFixedName(!!profile.username);
        setSelected(
          [
            ...new Set([
              ...profile.skills.map((s) => s.name),
              ...profile.keywords,
            ]),
          ].slice(0, 10),
        );
        if (profile.roles.length > 0) setRole(roleLabelFor(profile.roles));
      })
      .catch(() => {
        if (active) setError("Inicia sesión para cargar y guardar tu perfil.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (fixedName) return;
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(name)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<Availability>(`/api/username?u=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setAvailable(result.available);
          setStatus(
            result.available
              ? "Nombre disponible"
              : (result.message ?? "Ese nombre no está disponible."),
          );
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setStatus("No pudimos comprobar el nombre. Inténtalo más tarde.");
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name, fixedName]);
  function add(value: string) {
    const trimmed = value.trim().slice(0, 60);
    if (
      trimmed &&
      selected.length < 10 &&
      !selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    )
      setSelected([...selected, trimmed]);
    setQuery("");
  }
  async function save() {
    if (
      loading ||
      saving ||
      uploadingAvatar ||
      !authenticated ||
      !(fixedName || available) ||
      (offersServices(role) && selected.length === 0)
    )
      return;
    setSaving(true);
    setError("");
    try {
      if (!fixedName) {
        await api("/api/username", jsonRequest("PUT", { username: name }));
        setFixedName(true);
      }
      const known = selected.flatMap((label) => {
        const skill = catalog.find((s) => s.name === label);
        return skill
          ? [{ slug: skill.slug, level: levels[skill.slug] ?? 3 }]
          : [];
      });
      await api(
        "/api/profile",
        jsonRequest("PUT", {
          avatarUrl: avatar || null,
          roles: ROLES_BY_LABEL[role as (typeof roles)[number]],
          skills: known,
          keywords: selected.filter(
            (label) => !catalog.some((s) => s.name === label),
          ),
        }),
      );
      window.dispatchEvent(new Event("pact-profile-updated"));
      router.push("/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar el perfil. Tus cambios siguen aquí.",
      );
    } finally {
      setSaving(false);
    }
  }
  const suggestions = query.trim()
    ? catalog
        .filter(
          (s) =>
            s.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
            !selected.includes(s.name),
        )
        .slice(0, 5)
    : [];
  return (
    <section>
      <h1 className="profile-heading">Hagamos tu perfil.</h1>
      <p className="auth-muted">Cuéntanos cómo quieres participar en PACT.</p>
      <div className="profile-layout">
        <form
          className="auth-card profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <AvatarUpload value={avatar} onChange={setAvatar} onBusyChange={setUploadingAvatar} disabled={loading || saving || !authenticated} />
          <label htmlFor="username">Nombre de usuario</label>
          <div className="profile-input">
            <span>@</span>
            <input
              id="username"
              value={name}
              readOnly={fixedName}
              disabled={loading || saving}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/^@/, "");
                setName(value);
                setAvailable(false);
                setStatus(
                  !value
                    ? ""
                    : /^[a-z][a-z0-9_]{2,19}$/.test(value)
                      ? "Comprobando disponibilidad…"
                      : "Usa de 3 a 20 caracteres: letras, números o guion bajo. Empieza con una letra.",
                );
              }}
              placeholder="tu_nombre"
              autoComplete="username"
              aria-describedby="username-help"
              maxLength={20}
            />
          </div>
          <p id="username-help" className="field-help" aria-live="polite">
            {fixedName
              ? "Tu nombre público en PACT. No se puede cambiar una vez reservado."
              : status || "Será tu nombre público en PACT."}
          </p>
          <label htmlFor="skills">Tus habilidades</label>
          <div className="profile-input">
            <Search size={18} />
            <input
              id="skills"
              value={query}
              disabled={loading || saving}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(suggestions[0]?.name ?? query);
                }
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Busca o añade una habilidad"
              maxLength={60}
            />
          </div>
          {query.trim() && (
            <div className="skill-suggestions">
              {suggestions.map((s) => (
                <button type="button" key={s.slug} onClick={() => add(s.name)}>
                  {s.name}
                </button>
              ))}
              {!catalog.some(
                (s) => s.name.toLowerCase() === query.trim().toLowerCase(),
              ) && (
                <button type="button" onClick={() => add(query)}>
                  Añadir “{query.trim()}”
                </button>
              )}
            </div>
          )}
          <div className="skill-tags">
            {selected.map((skill) => (
              <span key={skill}>
                {skill}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setSelected(selected.filter((s) => s !== skill))
                  }
                  aria-label={`Quitar ${skill}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <p className="field-help">
            {offersServices(role)
              ? "Añade al menos una habilidad. Máximo 10."
              : "Opcional si solo vas a contratar. Máximo 10."}
          </p>
          <fieldset>
            <legend>¿Cómo quieres usar PACT?</legend>
            <div className="role-options">
              {roles.map((value, index) => {
                const Icon = [User, Laptop, Users][index];
                return (
                  <label
                    key={value}
                    className={
                      role === value ? "role-card selected" : "role-card"
                    }
                  >
                    <input
                      type="radio"
                      name="participation"
                      value={value}
                      checked={role === value}
                      disabled={saving}
                      onChange={() => setRole(value)}
                    />
                    <Icon size={25} />
                    <span>
                      <strong>{index === 2 ? "Ambos" : value}</strong>
                      <small>
                        {
                          [
                            "Quiero contratar talento",
                            "Quiero ofrecer mi trabajo",
                            "Quiero contratar y ofrecer servicios",
                          ][index]
                        }
                      </small>
                    </span>
                    {role === value && <Check size={16} />}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="field-help">
            Define qué puedes hacer en PACT: crear solicitudes si eres cliente,
            y postularte y recibir avisos de solicitudes que encajan contigo si
            eres prestador. Puedes cambiarlo cuando quieras.
          </p>
          {error && (
            <p role="alert" className="auth-error">
              {error}{" "}
              {!authenticated && (
                <Link href="/iniciar-sesion">Inicia sesión</Link>
              )}
            </p>
          )}
          <button
            className="profile-save"
            disabled={
              loading ||
              saving ||
              uploadingAvatar ||
              !authenticated ||
              !(fixedName || available) ||
              (offersServices(role) && selected.length === 0)
            }
          >
            {saving ? "Guardando…" : "Guardar y entrar a PACT"}
            <ArrowRight size={25} />
          </button>
        </form>
        <aside className="profile-preview">
          <h2>Así te verán</h2>
          <div className="preview-person">
            <div className="preview-identity">
              <ProfileAvatar src={avatar} className="h-16 w-16" />
              <div>
                <strong>@{name || "tu_nombre"}</strong>
                <p className="role-badge">{role}</p>
              </div>
            </div>
            <div className="skill-tags">
              {selected.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
              {!selected.length && (
                <p className="field-help">Tus habilidades aparecerán aquí.</p>
              )}
            </div>
          </div>
          <div className="profile-trust">
            <ShieldCheck size={45} />
            <div>
              <strong>Tu perfil, a tu manera</strong>
              <p>Puedes actualizar tus habilidades y tu rol más adelante.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
