"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, BriefcaseBusiness, Users } from "lucide-react";
import {
  Workspace,
  useResource,
  LoadState,
  Empty,
  Metric,
} from "@/components/Workspace";
import type { ListingDto } from "@/lib/shared/listings";
import type { ProviderSummaryDto, SkillDto } from "@/lib/shared/profile";
export default function Explore() {
  const [tab, setTab] = useState("opportunities");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const listings = useResource<{ listings: ListingDto[] }>(
    `/api/listings?scope=open&q=${encodeURIComponent(search)}`,
  );
  const providers = useResource<{ providers: ProviderSummaryDto[] }>(
    `/api/providers?q=${encodeURIComponent(search)}&skills=${encodeURIComponent(skill)}`,
  );
  const catalog = useResource<{ skills: SkillDto[] }>("/api/skills");
  const state = tab === "opportunities" ? listings : providers;
  return (
    <Workspace
      title="Encuentra tu próximo proyecto."
      intro="Conecta lo que sabes hacer con quienes lo necesitan."
    >
      <div className="workspace-banner">
        <div>
          <span>Talento + acuerdos claros</span>
          <h2>Una buena conexión empieza aquí.</h2>
          <p>Explora oportunidades o encuentra a la persona para tu idea.</p>
        </div>
        <div className="workspace-banner-symbol">
          <Users size={72} />
          <ArrowUpRight size={38} />
        </div>
      </div>
      <div className="workspace-toolbar">
        <div className="workspace-tabs" role="group" aria-label="Qué explorar">
          <button
            aria-pressed={tab === "opportunities"}
            onClick={() => setTab("opportunities")}
          >
            <BriefcaseBusiness size={18} />
            Oportunidades
          </button>
          <button
            aria-pressed={tab === "people"}
            onClick={() => setTab("people")}
          >
            <Users size={18} />
            Talento
          </button>
        </div>
        <Link className="btn-primary" href="/solicitudes/nueva">
          Publicar oportunidad <ArrowUpRight size={17} />
        </Link>
      </div>
      <form
        className="workspace-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
        }}
      >
        <Search size={20} />
        <input
          aria-label="Buscar oportunidades o talento"
          placeholder="Diseño, desarrollo, redacción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
        />
        {tab === "people" && (
          <select
            aria-label="Filtrar por habilidad"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            <option value="">Todas las habilidades</option>
            {catalog.data?.skills.map((s) => (
              <option value={s.slug} key={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn-secondary">Buscar</button>
      </form>
      <LoadState {...state} retry={state.reload} />
      <div className="workspace-grid">
        {tab === "opportunities"
          ? listings.data?.listings.map((item) => (
              <article className="workspace-card" key={item.id}>
                <span className="workspace-pill">
                  {item.category ?? "Oportunidad"}
                </span>
                <h2>
                  <Link href={`/solicitudes/${item.id}`}>{item.title}</Link>
                </h2>
                <p className="workspace-excerpt">{item.description}</p>
                <div className="workspace-metrics">
                  <Metric
                    value={`${item.budgetMon ?? "Por acordar"} MON`}
                    label="Presupuesto"
                  />
                  <Metric
                    value={
                      item.deadlineDays
                        ? `${item.deadlineDays} días`
                        : "Por acordar"
                    }
                    label="Entrega"
                  />
                </div>
                <footer>
                  <span>
                    {item.clientName ??
                      (item.clientUsername
                        ? `@${item.clientUsername}`
                        : "Cliente PACT")}
                  </span>
                  <Link
                    href={`/solicitudes/${item.id}`}
                    aria-label={`Ver ${item.title}`}
                  >
                    <ArrowUpRight size={22} />
                  </Link>
                </footer>
              </article>
            ))
          : providers.data?.providers.map((person) => (
              <article className="workspace-card" key={person.id}>
                <span className="workspace-pill">
                  {person.availability === "available"
                    ? "Disponible"
                    : person.availability === "busy"
                      ? "Ocupado"
                      : "No disponible"}
                </span>
                <h2>
                  <Link href={`/personas/${person.username ?? person.id}`}>
                    {person.displayName ??
                      (person.username
                        ? `@${person.username}`
                        : "Profesional PACT")}
                  </Link>
                </h2>
                <p>
                  {person.headline ?? "Conoce su trabajo y sus habilidades."}
                </p>
                <div className="skill-tags">
                  {person.skills.map((s) => (
                    <span key={s.slug}>{s.name}</span>
                  ))}
                </div>
                <div className="workspace-metrics">
                  <Metric
                    value={person.reputation.providerAverage?.toFixed(1) ?? "—"}
                    label={`${person.reputation.providerRatings} valoraciones`}
                  />
                  <Metric value={person.portfolioCount} label="Proyectos" />
                </div>
                <Link
                  className="workspace-link"
                  href={`/personas/${person.username ?? person.id}`}
                >
                  Ver perfil <ArrowUpRight size={18} />
                </Link>
              </article>
            ))}
      </div>
      {!state.loading &&
        !state.error &&
        (tab === "opportunities"
          ? listings.data?.listings.length === 0
          : providers.data?.providers.length === 0) && (
          <Empty>
            No hay resultados con esos filtros. Prueba otra búsqueda.
          </Empty>
        )}
    </Workspace>
  );
}
