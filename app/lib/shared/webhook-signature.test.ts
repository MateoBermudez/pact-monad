import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signWebhook, verifyWebhook } from "./webhook-signature.ts";

const SECRET = "whsec_prueba";
const BODY = JSON.stringify({ id: "d1", type: "agreement.delivered", data: { agreementId: "a1" } });
const NOW = 1_800_000_000_000;

describe("firma de webhooks", () => {
  it("una firma válida se verifica", async () => {
    const header = await signWebhook(SECRET, NOW / 1000, BODY);
    assert.match(header, /^t=\d+,v1=[0-9a-f]{64}$/);
    assert.equal(await verifyWebhook(SECRET, header, BODY, { nowMs: NOW }), true);
  });

  it("es determinista y cambia con el secreto, el cuerpo o la marca de tiempo", async () => {
    const a = await signWebhook(SECRET, 100, BODY);
    assert.equal(a, await signWebhook(SECRET, 100, BODY));
    assert.notEqual(a, await signWebhook("otro", 100, BODY));
    assert.notEqual(a, await signWebhook(SECRET, 100, BODY + " "));
    assert.notEqual(a, await signWebhook(SECRET, 101, BODY));
  });

  it("rechaza un cuerpo manipulado", async () => {
    const header = await signWebhook(SECRET, NOW / 1000, BODY);
    assert.equal(await verifyWebhook(SECRET, header, BODY.replace("a1", "a2"), { nowMs: NOW }), false);
  });

  it("rechaza un secreto equivocado", async () => {
    const header = await signWebhook(SECRET, NOW / 1000, BODY);
    assert.equal(await verifyWebhook("otro", header, BODY, { nowMs: NOW }), false);
  });

  it("rechaza repeticiones: un mensaje viejo no vale aunque la firma sea correcta", async () => {
    const header = await signWebhook(SECRET, NOW / 1000 - 3600, BODY);
    assert.equal(await verifyWebhook(SECRET, header, BODY, { nowMs: NOW }), false);
    assert.equal(await verifyWebhook(SECRET, header, BODY, { nowMs: NOW, toleranceSeconds: 7200 }), true);
  });

  it("rechaza marcas de tiempo del futuro lejano", async () => {
    const header = await signWebhook(SECRET, NOW / 1000 + 3600, BODY);
    assert.equal(await verifyWebhook(SECRET, header, BODY, { nowMs: NOW }), false);
  });

  it("no puede reutilizar la firma cambiando solo la marca de tiempo", async () => {
    const real = await signWebhook(SECRET, NOW / 1000 - 3600, BODY);
    const forged = real.replace(/t=\d+/, `t=${NOW / 1000}`);
    assert.equal(await verifyWebhook(SECRET, forged, BODY, { nowMs: NOW }), false);
  });

  it("rechaza cabeceras ausentes o mal formadas", async () => {
    for (const header of [null, "", "v1=abc", "t=1", "t=abc,v1=" + "a".repeat(64), `t=${NOW / 1000},v1=${"g".repeat(64)}`, `t=${NOW / 1000},v1=${"a".repeat(63)}`]) {
      assert.equal(await verifyWebhook(SECRET, header, BODY, { nowMs: NOW }), false, String(header));
    }
  });
});
