export const FILE_PURPOSES = ["brief", "portfolio", "evidence"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MB = 1024 * 1024;

export const FILE_RULES: Record<FilePurpose, { maxBytes: number; mimeTypes: readonly string[] }> = {
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
  evidence: {
    maxBytes: 10 * MB,
    mimeTypes: ["application/pdf", "text/plain", "image/png", "image/jpeg", "image/webp", "application/zip"],
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
