export const FILE_PURPOSES = ["brief", "portfolio", "evidence"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

const MB = 1024 * 1024;

export const FILE_RULES: Record<FilePurpose, { maxBytes: number; mimeTypes: readonly string[] }> = {
  brief: {
    maxBytes: 10 * MB,
    mimeTypes: ["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"],
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
