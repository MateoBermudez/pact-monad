"use client";
import "client-only";
import { useState } from "react";
import { uploadFile } from "@/lib/client/files";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/shared/avatar";
import { ProfileAvatar } from "./ProfileAvatar";

export function AvatarUpload({ value, onChange, onBusyChange, disabled = false }: {
  value: string;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="avatar-upload">
    <ProfileAvatar src={value} className="h-20 w-20" />
    <label>Foto de perfil
      <input type="file" accept={AVATAR_MIME_TYPES.join(",")} disabled={disabled || busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setError("");
          if (!AVATAR_MIME_TYPES.includes(file.type) || !file.size || file.size > AVATAR_MAX_BYTES) {
            setError("Elige una imagen JPG, PNG o WebP de hasta 2 MB.");
            return;
          }
          setBusy(true); onBusyChange(true);
          try {
            const uploaded = await uploadFile(file, "portfolio");
            onChange(`/api/avatars/${uploaded.id}`);
          } catch {
            setError("No pudimos subir la foto. Tu imagen anterior se conserva; vuelve a intentarlo.");
          } finally { setBusy(false); onBusyChange(false); }
        }} />
    </label>
    <small>{busy ? "Subiendo y validando la foto…" : "JPG, PNG o WebP · Hasta 2 MB. Se guarda al guardar tu perfil."}</small>
    {value && <button type="button" className="workspace-text-button" disabled={disabled || busy} onClick={() => onChange("")}>Quitar foto</button>}
    {error && <p role="alert" className="auth-error">{error}</p>}
  </div>;
}
