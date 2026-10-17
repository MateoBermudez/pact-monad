import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliveryNoteError, deliveryUrlError, MAX_DELIVERY_NOTE_BYTES, utf8Length } from "./delivery.ts";

describe("nota de entrega", () => {
  it("acepta hasta 500 bytes exactos", () => {
    assert.equal(deliveryNoteError("a".repeat(MAX_DELIVERY_NOTE_BYTES)), null);
  });

  it("rechaza 501 bytes y dice cuánto ocupa", () => {
    assert.match(deliveryNoteError("a".repeat(501)) ?? "", /501 de 500 bytes/);
  });

  it("cuenta bytes y no caracteres: las tildes y emojis ocupan más", () => {
    const note = "ñ".repeat(300);
    assert.equal(note.length, 300);
    assert.equal(utf8Length(note), 600);
    assert.ok(deliveryNoteError(note));
    assert.equal(deliveryNoteError("😀".repeat(125)), null);
    assert.ok(deliveryNoteError("😀".repeat(126)));
  });

  it("una nota de 2000 caracteres, como un HTML pegado, se rechaza", () => {
    assert.ok(deliveryNoteError("<!DOCTYPE html>\n".repeat(125)));
  });
});

describe("enlace de evidencia", () => {
  it("acepta 512 bytes y rechaza más", () => {
    assert.equal(deliveryUrlError(`https://e.co/${"a".repeat(499)}`), null);
    assert.ok(deliveryUrlError(`https://e.co/${"a".repeat(500)}`));
  });
});
