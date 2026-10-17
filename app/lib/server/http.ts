import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { DatabaseError } from "pg";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import type { Role, SessionUser } from "@/lib/shared/auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = "resource") => new ApiError(404, "not_found", `${what} no encontrado`);
export const forbidden = (message = "No tienes permiso para esto") => new ApiError(403, "forbidden", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);

const ROLE_LABELS: Record<Role, string> = { client: "cliente", provider: "prestador de servicios" };

export function requireRole(user: SessionUser, role: Role): void {
  if (!user.roles.includes(role)) {
    throw new ApiError(403, "role_required", `Activa tu rol de ${ROLE_LABELS[role]} en tu perfil para hacer esto`);
  }
}

export function requireWallet(user: SessionUser): string {
  if (!user.wallet) throw new ApiError(409, "wallet_required", "Vincula una wallet para operar en la cadena");
  return user.wallet;
}

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const RAISE_EXCEPTION = "P0001";

function toResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof DatabaseError) {
    if (error.code === RAISE_EXCEPTION && error.message === "insufficient_credits") {
      return Response.json({ error: "insufficient_credits", message: "No tienes créditos de IA suficientes" }, { status: 402 });
    }
    if (error.code === RAISE_EXCEPTION) {
      return Response.json({ error: "rejected", message: error.message }, { status: 422 });
    }
    if (error.code === UNIQUE_VIOLATION) {
      return Response.json({ error: "conflict", message: "Ya existe un registro igual" }, { status: 409 });
    }
    if (error.code === CHECK_VIOLATION || error.code === FOREIGN_KEY_VIOLATION) {
      return Response.json({ error: "invalid_request", message: "Los datos no cumplen las reglas del sistema" }, { status: 422 });
    }
  }
  console.error("[api]", error);
  return Response.json({ error: "unavailable" }, { status: 503 });
}

export function parseId(value: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw notFound();
  return result.data;
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const raw: unknown = await request.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".") || "cuerpo"}: ${issue.message}`).join("; ");
    throw new ApiError(400, "invalid_request", detail);
  }
  return result.data;
}

export function readQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new ApiError(400, "invalid_request", detail);
  }
  return result.data;
}

type Params = Record<string, string>;
type RouteHandlerContext<P extends Params> = { params: Promise<P> };

type AuthedHandler<P extends Params> = (args: { request: Request; params: P; user: SessionUser }) => Promise<unknown>;
type OpenHandler<P extends Params> = (args: { request: Request; params: P }) => Promise<unknown>;

const asResponse = (result: unknown): Response => (result instanceof Response ? result : Response.json(result ?? { ok: true }));

export function authed<P extends Params = Params>(handler: AuthedHandler<P>) {
  return async (request: Request, context: RouteHandlerContext<P>): Promise<Response> => {
    try {
      const user = await getSessionUser();
      if (!user) throw new ApiError(401, "unauthenticated");
      return asResponse(await handler({ request, params: await context.params, user }));
    } catch (error) {
      unstable_rethrow(error);
      return toResponse(error);
    }
  };
}

type OptionalHandler<P extends Params> = (args: { request: Request; params: P; user: SessionUser | null }) => Promise<unknown>;

// Lecturas públicas: con sesión se personalizan (recomendaciones, "mi postulación"), sin ella funcionan igual.
export function optional<P extends Params = Params>(handler: OptionalHandler<P>) {
  return async (request: Request, context: RouteHandlerContext<P>): Promise<Response> => {
    try {
      const user = await getSessionUser();
      return asResponse(await handler({ request, params: await context.params, user }));
    } catch (error) {
      unstable_rethrow(error);
      return toResponse(error);
    }
  };
}

// Las claves de API sirven para operar, no para emitir más credenciales: eso exige la wallet.
export function requireWalletSession(user: SessionUser): void {
  if (user.via !== "session") throw forbidden("Esto solo se puede hacer con sesión de wallet, no con una clave de API");
}

export function open<P extends Params = Params>(handler: OpenHandler<P>) {
  return async (request: Request, context: RouteHandlerContext<P>): Promise<Response> => {
    try {
      await connection();
      return asResponse(await handler({ request, params: await context.params }));
    } catch (error) {
      unstable_rethrow(error);
      return toResponse(error);
    }
  };
}
