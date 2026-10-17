import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFile } from "@/lib/client/files";
import { fileReference, referencedFileId } from "@/lib/shared/file-reference";
afterEach(() => vi.unstubAllGlobals());
describe("archivos firmados", () => {
  it("sube directamente a Storage y completa la validación antes de devolver el archivo", async () => {
    const ticket = {
      fileId: "f1",
      uploadUrl: "https://storage.example/upload?token=temporary",
      method: "PUT",
      headers: { "content-type": "application/pdf" },
    };
    const file = new File(["%PDF-content"], "brief.pdf", {
      type: "application/pdf",
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ticket })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ file: { id: "f1", sha256: "verified" } }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await uploadFile(file, "brief")).toEqual({
      id: "f1",
      sha256: "verified",
    });
    expect(fetcher.mock.calls[0][0]).toBe("/api/files/upload-url");
    expect(fetcher.mock.calls[1]).toEqual([
      ticket.uploadUrl,
      { method: "PUT", headers: ticket.headers, body: file },
    ]);
    expect(fetcher.mock.calls[2][0]).toBe("/api/files/f1/complete");
  });
  it("no confirma una subida fallida", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ticket: {
              fileId: "f1",
              uploadUrl: "https://storage.example/upload",
              method: "PUT",
              headers: {},
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      uploadFile(
        new File(["data"], "brief.pdf", { type: "application/pdf" }),
        "brief",
      ),
    ).rejects.toThrow("403");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("mantiene una referencia estable y rechaza identificadores o URLs arbitrarias", () => {
    const id = "aa713c68-8ac6-4c26-9911-4d160550fbee";
    expect(referencedFileId(fileReference(id))).toBe(id);
    expect(
      referencedFileId("https://example.com/token?expires=soon"),
    ).toBeNull();
    expect(referencedFileId("pact-file:../../secrets")).toBeNull();
  });
});
