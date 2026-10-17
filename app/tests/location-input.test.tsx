import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { LocationInput } from "@/components/LocationInput";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Field() {
  const [value, setValue] = useState("");
  return <form onSubmit={(event) => event.preventDefault()}><LocationInput value={value} onChange={setValue} /></form>;
}
it("busca tras una pausa, permite seleccionar con teclado y conserva la selección", async () => {
  const fetcher = vi.fn(async () => Response.json({ suggestions: [{ id: "1", label: "Medellín, Antioquia, Colombia" }] }));
  vi.stubGlobal("fetch", fetcher);
  render(<Field />);
  const input = screen.getByRole("combobox", { name: "Ubicación" });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "Me" } });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Med" } });
  fireEvent.change(input, { target: { value: "Medell" } });
  await screen.findByRole("option", { name: "Medellín, Antioquia, Colombia" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]).toBeDefined();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("Medellín, Antioquia, Colombia");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.blur(input);
  fireEvent.focus(input);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
it("conserva texto manual cuando la API falla y oculta resultados anteriores al editar", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ suggestions: [{ id: "1", label: "Bogotá, Colombia" }] })).mockRejectedValue(new Error("offline")));
  render(<Field />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "Bogota" } });
  await screen.findByRole("option");
  fireEvent.change(input, { target: { value: "Calle 10" } });
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("no está disponible"));
  expect(input).toHaveValue("Calle 10");
});
