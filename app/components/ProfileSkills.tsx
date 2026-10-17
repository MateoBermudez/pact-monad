"use client";
import { useId, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useResource } from "@/components/Workspace";
import {
  MAX_SKILLS,
  type SkillDto,
  type UserSkillDto,
} from "@/lib/shared/profile";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function ProfileSkills({
  skills,
  keywords,
  onSkillsChange,
  onKeywordsChange,
  disabled,
}: {
  skills: UserSkillDto[];
  keywords: string[];
  onSkillsChange: (skills: UserSkillDto[]) => void;
  onKeywordsChange: (keywords: string[]) => void;
  disabled: boolean;
}) {
  const id = useId();
  const catalog = useResource<{ skills: SkillDto[] }>("/api/skills");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  function add(label: string) {
    if (disabled) return;
    const value = label.trim();
    if (!value) return;
    if (
      skills.some((skill) => normalize(skill.name) === normalize(value)) ||
      keywords.some((keyword) => normalize(keyword) === normalize(value))
    ) {
      setNotice("Esa habilidad ya está en tu perfil.");
      return;
    }
    const known = catalog.data?.skills.find(
      (skill) => normalize(skill.name) === normalize(value),
    );
    if (known) {
      if (skills.length >= MAX_SKILLS) {
        setNotice(
          `Puedes elegir hasta ${MAX_SKILLS} habilidades del catálogo. Quita una para añadir otra.`,
        );
        return;
      }
      onSkillsChange([...skills, { ...known, level: 3 }]);
    } else {
      if (keywords.length >= 40) {
        setNotice(
          "Puedes añadir hasta 40 habilidades personalizadas. Quita una para añadir otra.",
        );
        return;
      }
      onKeywordsChange([...keywords, value]);
    }
    setQuery("");
    setNotice(
      "Habilidad añadida. Guarda el perfil para conservar los cambios.",
    );
  }
  const suggestions = query.trim()
    ? (catalog.data?.skills ?? [])
        .filter(
          (skill) =>
            normalize(skill.name).includes(normalize(query)) &&
            !skills.some((selected) => selected.slug === skill.slug),
        )
        .slice(0, 5)
    : [];
  return (
    <fieldset className="account-skills" disabled={disabled}>
      <legend>Tus habilidades</legend>
      <p id={`${id}-help`} className="field-help">
        Estas son las habilidades que registraste en PACT. Puedes cambiar su
        nivel, quitarlas o añadir otras.
      </p>
      <div className="account-skills-list">
        {skills.map((skill) => (
          <div key={skill.slug} className="account-skill">
            <strong>{skill.name}</strong>
            <select
              aria-label={`Nivel de ${skill.name}`}
              value={skill.level}
              onChange={(event) =>
                onSkillsChange(
                  skills.map((current) =>
                    current.slug === skill.slug
                      ? { ...current, level: Number(event.target.value) }
                      : current,
                  ),
                )
              }
            >
              {["Inicial", "Básico", "Intermedio", "Avanzado", "Experto"].map(
                (label, index) => (
                  <option key={label} value={index + 1}>
                    {index + 1} · {label}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              aria-label={`Quitar habilidad ${skill.name}`}
              onClick={() =>
                onSkillsChange(
                  skills.filter((current) => current.slug !== skill.slug),
                )
              }
            >
              <X size={17} />
            </button>
          </div>
        ))}
        {keywords.map((keyword) => (
          <div key={keyword} className="account-skill account-skill-custom">
            <strong>{keyword}</strong>
            <span>Personalizada</span>
            <button
              type="button"
              aria-label={`Quitar habilidad ${keyword}`}
              onClick={() =>
                onKeywordsChange(
                  keywords.filter((current) => current !== keyword),
                )
              }
            >
              <X size={17} />
            </button>
          </div>
        ))}
        {!skills.length && !keywords.length && (
          <p className="field-help">
            No has añadido habilidades. Busca una o escribe la tuya para
            empezar.
          </p>
        )}
      </div>
      <label htmlFor={`${id}-search`} className="account-skills-search-label">
        Añadir una habilidad
      </label>
      <div className="account-skills-search">
        <Search size={18} aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          maxLength={60}
          placeholder="Busca o escribe una habilidad"
          aria-describedby={`${id}-help`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setNotice("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(query);
            }
            if (event.key === "Escape") setQuery("");
          }}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || !query.trim()}
          onClick={() => add(query)}
        >
          <Plus size={16} />
          Añadir
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul
          className="account-skill-suggestions"
          aria-label="Habilidades sugeridas"
        >
          {suggestions.map((skill) => (
            <li key={skill.slug}>
              <button type="button" onClick={() => add(skill.name)}>
                <span>{skill.name}</span>
                <Plus size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {catalog.loading && (
        <p className="field-help" role="status">
          Cargando sugerencias…
        </p>
      )}
      {catalog.error && (
        <p className="field-help">
          No se pudo cargar el catálogo. Tus habilidades guardadas siguen aquí y
          puedes añadir una personalizada.{" "}
          <button
            type="button"
            className="workspace-text-button"
            onClick={() => void catalog.reload()}
          >
            Reintentar catálogo
          </button>
        </p>
      )}
      <p className="field-help">
        Hasta {MAX_SKILLS} habilidades del catálogo y 40 personalizadas. Los
        cambios se aplican con “Guardar perfil”.
      </p>
      {notice && (
        <p className="field-help" role="status">
          {notice}
        </p>
      )}
    </fieldset>
  );
}
