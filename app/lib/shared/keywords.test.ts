import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKeywords, normalizeKeywords } from "./keywords.ts";

describe("deriveKeywords", () => {
  it("toma los términos más repetidos y descarta palabras vacías", () => {
    const keywords = deriveKeywords(
      "Busco un desarrollador backend para APIs REST con Node.js. El backend usa PostgreSQL y el backend necesita pruebas.",
    );
    assert.equal(keywords[0], "backend");
    assert.ok(keywords.includes("node.js") && keywords.includes("postgresql") && keywords.includes("desarrollador"));
    assert.ok(!keywords.includes("para") && !keywords.includes("con") && !keywords.includes("busco"));
  });

  it("quita tildes, ignora números sueltos y respeta el límite", () => {
    const keywords = deriveKeywords("Diseño de logotipos 2024 con ilustración y animación gráfica vectorial", 3);
    assert.equal(keywords.length, 3);
    assert.ok(keywords.every((word) => word === normalizeKeywords([word])[0]));
    assert.ok(!keywords.includes("2024"));
  });

  it("un texto vacío no da palabras clave", () => {
    assert.deepEqual(deriveKeywords("   "), []);
  });
});
