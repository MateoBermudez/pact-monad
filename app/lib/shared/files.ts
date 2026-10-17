export const FILE_PURPOSES = ["brief", "portfolio", "evidence"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MB = 1024 * 1024;

// Tipo que se usa cuando el navegador no sabe el de un archivo (extensiones raras, binarios, código fuente...).
export const ANY_FILE_MIME = "application/octet-stream";

// `mimeTypes: null` = se acepta cualquier tipo de archivo, sin comprobar su contenido.
export type FileRule = { maxBytes: number; mimeTypes: readonly string[] | null };

// Tipos que el navegador puede mostrar sin riesgo; todo lo demás (HTML, SVG, ejecutables...) se descarga.
export const INLINE_SAFE_MIMES: readonly string[] = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"];

export const FILE_RULES: Record<FilePurpose, FileRule> = {
  brief: {
    // El brief viaja en base64 (+33%) a pact-ai, que corre en Vercel con un tope de 4,5 MB por petición:
    // más de 3 MB no se podría analizar.
    maxBytes: 3 * MB,
    mimeTypes: ["application/pdf", DOCX_MIME, "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"],
  },
  portfolio: {
    maxBytes: 10 * MB,
    mimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/zip"],
  },
  // La entrega puede ser cualquier cosa (código, audio, video, diseño, un binario...): sin filtro de tipo.
  // El tope lo marca el límite por archivo de Supabase Storage en el plan gratuito.
  evidence: {
    maxBytes: 50 * MB,
    mimeTypes: null,
  },
};

export type FileDto = {
  id: string;
  purpose: FilePurpose;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

export type UploadTicketDto = {
  fileId: string;
  uploadUrl: string;
  method: "PUT";
  headers: { "content-type": string };
  expiresInSeconds: number;
};
