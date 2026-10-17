import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/avatars/[id]/route";
const files = vi.hoisted(() => ({ getSignedFileUrl: vi.fn() }));
vi.mock("@/lib/server/services/files", () => files);
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
const id = "11111111-1111-4111-8111-111111111111";
afterEach(() => vi.clearAllMocks());
it("resuelve la referencia estable a un enlace firmado sin almacenar la redirección", async () => {
  files.getSignedFileUrl.mockResolvedValue({ url: "https://storage.example/foto?token=new", file: { mimeType: "image/png", sizeBytes: 100 } });
  const response = await GET(new Request(`https://pact.example/api/avatars/${id}`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("https://storage.example/foto?token=new");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(files.getSignedFileUrl).toHaveBeenCalledWith(null, id);
});
it("no sirve documentos ni imágenes demasiado grandes como avatares", async () => {
  for (const file of [{ mimeType: "application/pdf", sizeBytes: 100 }, { mimeType: "image/jpeg", sizeBytes: 3 * 1024 * 1024 }]) {
    files.getSignedFileUrl.mockResolvedValue({ url: "https://storage.example/file", file });
    const response = await GET(new Request(`https://pact.example/api/avatars/${id}`), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(404);
    expect(response.headers.get("Location")).toBeNull();
  }
});
