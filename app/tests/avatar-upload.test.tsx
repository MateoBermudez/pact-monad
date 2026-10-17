import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AvatarUpload } from "@/components/AvatarUpload";
import { updateProfileSchema } from "@/lib/shared/schemas";
const upload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/client/files", () => ({ uploadFile: upload }));
afterEach(() => { cleanup(); upload.mockReset(); });
function Editor() {
  const [url, setUrl] = useState("https://example.com/original.jpg");
  const [busy, setBusy] = useState(false);
  return <><AvatarUpload value={url} onChange={setUrl} onBusyChange={setBusy} /><button disabled={busy}>Guardar</button><output>{url}</output></>;
}
it("sube una imagen con el flujo firmado y permite quitarla", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  upload.mockResolvedValue({ id });
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Foto de perfil"), { target: { files: [new File(["png"], "foto.png", { type: "image/png" })] } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`/api/avatars/${id}`));
  expect(upload).toHaveBeenCalledWith(expect.any(File), "portfolio");
  expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  expect(screen.getByRole("img")).toHaveAttribute("src", `/api/avatars/${id}`);
  fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
  expect(screen.queryByRole("img")).toBeNull();
});
it("rechaza formatos ajenos y conserva la imagen anterior ante fallos", async () => {
  render(<Editor />);
  const input = screen.getByLabelText("Foto de perfil");
  fireEvent.change(input, { target: { files: [new File(["pdf"], "foto.pdf", { type: "application/pdf" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent("hasta 2 MB");
  expect(upload).not.toHaveBeenCalled();
  upload.mockRejectedValue(new Error("offline"));
  fireEvent.change(input, { target: { files: [new File(["jpg"], "foto.jpg", { type: "image/jpeg" })] } });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("imagen anterior se conserva"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/original.jpg");
});
it("acepta referencias estables de avatar y rechaza otras rutas y esquemas", () => {
  expect(updateProfileSchema.safeParse({ avatarUrl: "/api/avatars/11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  for (const avatarUrl of ["/api/files/123", "javascript:alert(1)", "//external.test/image", "/api/avatars/../files"]) {
    expect(updateProfileSchema.safeParse({ avatarUrl }).success).toBe(false);
  }
});
