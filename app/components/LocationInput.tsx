"use client";
import "client-only";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/client/api";
import type { LocationSuggestion } from "@/lib/shared/locations";

export function LocationInput({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(value);
  const [results, setResults] = useState<{ query: string; items: LocationSuggestion[] }>({ query: "", items: [] });
  const [status, setStatus] = useState("");
  const [active, setActive] = useState(-1);
  const query = value.trim();
  const searching = focused && !disabled && query.length >= 3 && value !== selected;
  const items = searching && results.query === query ? results.items : [];
  const open = searching && items.length > 0;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("Buscando ubicaciones…");
      void api<{ suggestions: LocationSuggestion[] }>(`/api/locations?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(({ suggestions }) => {
          if (controller.signal.aborted) return;
          setResults({ query, items: suggestions });
          setStatus(suggestions.length ? "" : "Sin sugerencias. Puedes escribir tu ubicación manualmente.");
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("La búsqueda no está disponible. Puedes escribir tu ubicación manualmente.");
        });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searching]);

  function choose(item: LocationSuggestion) {
    onChange(item.label);
    setSelected(item.label);
    setActive(-1);
    setStatus("");
  }

  return <div className="location-field">
    <label htmlFor={id}>Ubicación</label>
    <input id={id} role="combobox" autoComplete="off" value={value} maxLength={80}
      disabled={disabled} placeholder="Busca una ciudad o dirección"
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`}
      aria-describedby={`${id}-help`}
      aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
      onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setActive(-1); }}
      onChange={(event) => { onChange(event.target.value); setActive(-1); setStatus(""); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setFocused(false); setActive(-1); }
        if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          setActive((previous) => event.key === "ArrowDown" ? (previous + 1) % items.length : (previous <= 0 ? items.length - 1 : previous - 1));
        }
        if (open && event.key === "Enter") {
          event.preventDefault();
          if (active >= 0) choose(items[active]);
        }
      }} />
    {open && <ul id={`${id}-options`} role="listbox" aria-label="Ubicaciones sugeridas" className="location-options">
      {items.map((item, index) => <li key={item.id} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.label}</li>)}
    </ul>}
    <small id={`${id}-help`}>Escribe al menos 3 caracteres. Sugerencias de <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.</small>
    {searching && status && <small role="status">{status}</small>}
  </div>;
}
