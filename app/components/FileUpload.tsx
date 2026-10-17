"use client";
import { useState } from "react";
import { Paperclip, ExternalLink, X } from "lucide-react";
import { uploadFile } from "@/lib/client/files";
import { api } from "@/lib/client/api";
import { FILE_RULES, type FileDto, type FilePurpose } from "@/lib/shared/files";
import { messageOf } from "./Workspace";
export function FileUpload({
  purpose,
  value,
  onChange,
  onBusyChange,
  disabled = false,
}: {
  purpose: FilePurpose;
  value: FileDto | null;
  onChange: (file: FileDto | null) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rules = FILE_RULES[purpose];
  return (
    <div className="file-upload">
      <label>
        <Paperclip size={18} />
        {busy
          ? "Subiendo y validando…"
          : value
            ? value.fileName
            : "Adjuntar archivo"}
        <input
          aria-label={`Adjuntar archivo de ${purpose}`}
          type="file"
          accept={rules.mimeTypes.join(",")}
          disabled={busy || disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            if (!file.size || file.size > rules.maxBytes) {
              setError(
                `El archivo debe pesar entre 1 byte y ${rules.maxBytes / 1024 / 1024} MB.`,
              );
              return;
            }
            if (!rules.mimeTypes.includes(file.type)) {
              setError("Ese formato de archivo no está permitido.");
              return;
            }
            setBusy(true);
            onBusyChange?.(true);
            try {
              onChange(await uploadFile(file, purpose));
            } catch (e) {
              setError(messageOf(e));
            } finally {
              setBusy(false);
              onBusyChange?.(false);
            }
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onChange(null)}
          aria-label="Quitar archivo"
        >
          <X size={18} />
        </button>
      )}
      <small>
        Máximo {rules.maxBytes / 1024 / 1024} MB ·{" "}
        {purpose === "brief"
          ? "PDF, texto o imagen"
          : purpose === "portfolio"
            ? "PDF, imagen o ZIP"
            : "PDF, texto, imagen o ZIP"}
        . Se valida al terminar la subida.
      </small>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function FileLink({
  id,
  label = "Abrir archivo",
}: {
  id: string;
  label?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  return (
    <span className="file-link">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setUrl("");
          try {
            const result = await api<{ url: string }>(`/api/files/${id}`);
            setUrl(result.url);
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparando enlace…" : label}
        <ExternalLink size={15} />
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          Ver o descargar (enlace temporal)
        </a>
      )}
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
