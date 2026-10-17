import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, postJson } from "@/lib/client/api";
import { uploadFile } from "@/lib/client/files";

afterEach(() => vi.unstubAllGlobals());

describe("cliente API compartido tras integrar main", () => {
  it("mantiene la sesión al enviar JSON", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ message: "challenge" }));
    vi.stubGlobal("fetch", fetch);
    expect(await postJson("/api/auth/nonce", { address: "wallet" })).toEqual({
      message: "challenge",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/nonce",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ address: "wallet" }),
      }),
    );
  });

  it("conserva los códigos y mensajes de error del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "insufficient_credits", message: "No tienes créditos" },
            { status: 402 },
          ),
        ),
    );
    const error = await postJson("/api/listings/id/structure", {}).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 402,
      code: "insufficient_credits",
      message: "No tienes créditos",
    });
  });

  it("sube a Storage y confirma el archivo usando los endpoints nuevos de main", async () => {
    const file = new File(["evidencia"], "entrega.txt", { type: "text/plain" });
    const saved = {
      id: "file-id",
      fileName: file.name,
      mimeType: file.type,
      purpose: "evidence",
      sizeBytes: file.size,
      sha256: "hash",
      createdAt: "2026-10-17T00:00:00Z",
    };
    const ticket = {
      fileId: saved.id,
      uploadUrl: "https://storage.example/upload",
      method: "PUT",
      headers: { "content-type": file.type },
      expiresInSeconds: 120,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ticket }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ file: saved }));
    vi.stubGlobal("fetch", fetch);
    expect(await uploadFile(file, "evidence")).toEqual(saved);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/files/upload-url",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(2, ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.headers,
      body: file,
    });
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      `/api/files/${saved.id}/complete`,
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });
});
