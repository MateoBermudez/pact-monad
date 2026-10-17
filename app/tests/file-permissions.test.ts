import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/server/db", () => ({ query: mocks.query }));
vi.mock("@/lib/server/storage", () => ({
  signObjectUrl: mocks.sign,
  createSignedUploadUrl: vi.fn(),
  deleteObject: vi.fn(),
  downloadObject: vi.fn(),
}));
import { getSignedFileUrl } from "@/lib/server/services/files";
const id = "aa713c68-8ac6-4c26-9911-4d160550fbee";
const file = {
  id,
  owner_id: "provider",
  purpose: "evidence",
  storage_path: "private/evidence.pdf",
  file_name: "evidence.pdf",
  mime_type: "application/pdf",
  size_bytes: "100",
  sha256: "hash",
  status: "ready",
  created_at: new Date(),
};
beforeEach(() => {
  mocks.query.mockReset();
  mocks.sign.mockReset();
});
describe("evidencias privadas", () => {
  it("permite a la contraparte leer solo la evidencia vinculada a su acuerdo", async () => {
    mocks.query
      .mockResolvedValueOnce([file])
      .mockResolvedValueOnce([{ id: "agreement" }]);
    mocks.sign.mockResolvedValue("https://storage.example/fresh-token");
    expect((await getSignedFileUrl("client", id)).url).toContain("fresh-token");
    expect(mocks.query.mock.calls[1][1]).toEqual([
      `pact-file:${id}`,
      "client",
      "provider",
    ]);
  });
  it("no firma una URL para una persona ajena al acuerdo", async () => {
    mocks.query.mockResolvedValueOnce([file]).mockResolvedValueOnce([]);
    await expect(getSignedFileUrl("stranger", id)).rejects.toThrow(
      "No tienes acceso",
    );
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
