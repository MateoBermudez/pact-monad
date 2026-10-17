import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeUsername, usernameError } from "./username.ts";

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
