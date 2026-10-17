export const FILE_PURPOSES = ["brief", "portfolio", "evidence"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MB = 1024 * 1024;

export const FILE_RULES: Record<FilePurpose, { maxBytes: number; mimeTypes: readonly string[] }> = {
  brief: {
    // pact-ai acepta hasta 7 MB por archivo: un brief más grande no se podría analizar.
    maxBytes: 7 * MB,
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
