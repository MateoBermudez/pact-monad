import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeUsername, usernameError, usernameFromText, usernameProblem, usernameVariants } from "./username.ts";

describe("normalizeUsername", () => {
  it("pasa a minúsculas, recorta espacios y quita la arroba", () => {
    assert.equal(normalizeUsername("  @Mateo_B "), "mateo_b");
  });
});

describe("usernameError", () => {
  it("acepta nombres válidos", () => {
    assert.equal(usernameError("emma_12"), null);
    assert.equal(usernameError("abc"), null);
    assert.equal(usernameError("a".repeat(20)), null);
  });

  it("rechaza longitud y caracteres inválidos", () => {
    assert.notEqual(usernameError("ab"), null);
    assert.notEqual(usernameError("a".repeat(21)), null);
    assert.notEqual(usernameError("1abc"), null);
    assert.notEqual(usernameError("con espacio"), null);
    assert.notEqual(usernameError("ñandu"), null);
    assert.notEqual(usernameError("Mayus"), null);
  });

  it("rechaza nombres reservados", () => {
    assert.notEqual(usernameError("admin"), null);
    assert.notEqual(usernameError("pact"), null);
  });
});

describe("usernameProblem", () => {
  it("distingue formato inválido de nombre reservado", () => {
    assert.equal(usernameProblem("ab"), "invalid");
    assert.equal(usernameProblem("admin"), "reserved");
    assert.equal(usernameProblem("emma_12"), null);
  });
});

describe("usernameFromText", () => {
  it("convierte nombres y correos en un username válido", () => {
    assert.equal(usernameFromText("Emmanuel Arango"), "emmanuel_arango");
    assert.equal(usernameFromText("José Ñandú"), "jose_nandu");
    assert.equal(usernameFromText("juan.perez99@gmail.com"), "juan_perez99");
  });

  it("recorta a 20 caracteres y no empieza con número", () => {
    assert.equal(usernameFromText("1234 Maria"), "maria");
    assert.equal(usernameFromText("a".repeat(40))?.length, 20);
  });

  it("devuelve null si queda demasiado corto", () => {
    assert.equal(usernameFromText("!!"), null);
    assert.equal(usernameFromText("ab"), null);
  });
});

describe("usernameVariants", () => {
  it("agrega sufijos sin pasar de 20 caracteres y sin repetidos", () => {
    const variants = usernameVariants("a".repeat(20), ["1", "42"]);
    assert.ok(variants.every((variant) => variant.length <= 20));
    assert.equal(new Set(variants).size, variants.length);
    assert.ok(variants.includes("a".repeat(19) + "1"));
  });

  it("descarta variantes inválidas o reservadas", () => {
    assert.deepEqual(usernameVariants("adm", ["in"]), ["adm"]);
  });
});
