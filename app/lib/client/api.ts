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

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiRequestError(res.status, detail?.error ?? "error", detail?.message ?? `${path} respondió ${res.status}`);
  }
  return (await res.json()) as T;
}
