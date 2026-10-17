import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOCX_MIME, FILE_RULES } from "./files.ts";

describe("reglas de archivos", () => {
  it("los briefs aceptan PDF, DOCX, texto e imágenes", () => {
    const accepted = FILE_RULES.brief.mimeTypes;
    for (const mime of ["application/pdf", DOCX_MIME, "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"]) {
      assert.ok(accepted.includes(mime), mime);
    }
  });

  it("el DOCX solo se acepta en briefs, que es lo que la IA sabe leer", () => {
    assert.ok(!FILE_RULES.portfolio.mimeTypes.includes(DOCX_MIME));
    assert.ok(!FILE_RULES.evidence.mimeTypes.includes(DOCX_MIME));
  });

  it("un brief no supera lo que pact-ai puede procesar", () => {
    assert.equal(FILE_RULES.brief.maxBytes, 7 * 1024 * 1024);
  });
});
