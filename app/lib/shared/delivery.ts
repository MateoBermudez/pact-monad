export const MAX_DELIVERY_NOTE_BYTES = 500;
export const MAX_DELIVERY_URL_BYTES = 512;

const encoder = new TextEncoder();

export const utf8Length = (value: string): number => encoder.encode(value).length;

export function deliveryNoteError(note: string): string | null {
  const bytes = utf8Length(note);
  if (bytes <= MAX_DELIVERY_NOTE_BYTES) return null;
  return `La nota ocupa ${bytes} de ${MAX_DELIVERY_NOTE_BYTES} bytes. Resúmela: el contrato no admite más. Los enlaces, archivos y detalles largos van como evidencia.`;
}

export function deliveryUrlError(url: string): string | null {
  return utf8Length(url) > MAX_DELIVERY_URL_BYTES
    ? `El enlace supera ${MAX_DELIVERY_URL_BYTES} bytes. Usa uno más corto o sube un archivo.`
    : null;
}
