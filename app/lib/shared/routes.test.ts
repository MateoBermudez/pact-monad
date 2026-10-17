import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideRoute, isPublicPath } from "./routes.ts";

describe("decideRoute", () => {
  it("sin sesión, cualquier pantalla privada lleva al inicio de sesión", () => {
    for (const path of ["/dashboard", "/crear", "/perfil", "/configuracion", "/conectar", "/pact/123", "/explorar", "/cuenta"]) {
      assert.equal(decideRoute(path, false), "/iniciar-sesion", path);
    }
  });

  it("sin sesión se puede ver la landing, el acceso, el registro y los documentos legales", () => {
    for (const path of ["/", "/iniciar-sesion", "/registro", "/terminos", "/privacidad"]) {
      assert.equal(decideRoute(path, false), null, path);
    }
  });

  it("con sesión, el acceso y el registro llevan al dashboard", () => {
    assert.equal(decideRoute("/iniciar-sesion", true), "/dashboard");
    assert.equal(decideRoute("/registro", true), "/dashboard");
  });

  it("con sesión, el resto de pantallas siguen disponibles, incluidos los documentos legales", () => {
    for (const path of ["/", "/dashboard", "/crear", "/perfil", "/terminos", "/privacidad", "/pact/123"]) {
      assert.equal(decideRoute(path, true), null, path);
    }
  });

  it("con sesión la landing sigue disponible y no redirige al dashboard", () => {
    assert.equal(decideRoute("/", true), null);
  });

  it("no confunde rutas parecidas con las públicas", () => {
    assert.equal(isPublicPath("/iniciar-sesion/otra"), false);
    assert.equal(decideRoute("/registro-falso", false), "/iniciar-sesion");
  });
});
