"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, jsonRequest } from "@/lib/client/api";
import { MAX_SCREENING_CRITERIA, type ScreeningSettingsDto } from "@/lib/shared/schemas";

const MODES: { value: ScreeningSettingsDto["mode"]; title: string; text: string }[] = [
  {
    value: "assist",
    title: "Evaluar y recomendar",
    text: "La IA analiza cada propuesta con el perfil, el portafolio y la reputación, y preselecciona las buenas. Tú eliges con quién trabajar.",
  },
  {
    value: "auto",
    title: "Decidir por mí",
    text: "La IA descarta las que no encajan y elige la primera que cumple. Después solo firmas desde tu wallet para bloquear los fondos.",
  },
  {
    value: "off",
    title: "Solo yo",
    text: "No se evalúa nada. Recibes las propuestas tal cual y decides tú.",
  },
];

export function ScreeningSettings() {
  const [mode, setMode] = useState<ScreeningSettingsDto["mode"]>("assist");
  const [criteria, setCriteria] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ settings: ScreeningSettingsDto }>("/api/settings/screening")
      .then(({ settings }) => {
        setMode(settings.mode);
        setCriteria(settings.criteria);
        setLoaded(true);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo cargar tu configuración."));
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api("/api/settings/screening", jsonRequest("PUT", { mode, criteria }));
      toast.success("Configuración de propuestas guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-card workspace-form" aria-labelledby="screening-title">
      <h2 id="screening-title">Cómo recibes las propuestas</h2>
      <p className="field-help">
        Cuando alguien se postula a tu solicitud, tu IA puede revisarlo por ti. Cada evaluación cuesta 1 crédito.
      </p>
      <div className="screening-modes" role="radiogroup" aria-label="Modo de evaluación de propuestas">
        {MODES.map((item) => (
          <label className="screening-mode" key={item.value}>
            <input
              type="radio"
              name="screening-mode"
              value={item.value}
              checked={mode === item.value}
              disabled={!loaded || busy}
              onChange={() => setMode(item.value)}
            />
            <b>{item.title}</b>
            <span>{item.text}</span>
          </label>
        ))}
      </div>
      <label>
        Tus criterios (opcional)
        <textarea
          rows={4}
          maxLength={MAX_SCREENING_CRITERIA}
          value={criteria}
          disabled={!loaded || busy || mode === "off"}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder="Ej.: prefiero perfiles con portafolio en fintech, mínimo 2 trabajos completados, y respuesta clara sobre cómo probarán el código."
        />
        <span className="field-help">
          La IA los aplica al comparar el perfil, el portafolio y la propuesta. {criteria.length}/{MAX_SCREENING_CRITERIA}
        </span>
      </label>
      <button className="btn-primary" disabled={!loaded || busy} onClick={() => void save()}>
        {busy ? "Guardando…" : "Guardar"}
      </button>
    </section>
  );
}
