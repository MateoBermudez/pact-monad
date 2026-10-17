import "client-only";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data as { error?: string; message?: string } | null;
    throw new ApiRequestError(
      response.status,
      error?.error ?? "unavailable",
      error?.message ??
        (response.status === 401
          ? "Inicia sesión para continuar."
          : "No se pudo completar la solicitud. Inténtalo de nuevo."),
    );
  }
  return data as T;
}
export const jsonRequest = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

/** Shared by wallet sign-in and direct Storage uploads from main. */
export function postJson<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, jsonRequest("POST", body));
}
