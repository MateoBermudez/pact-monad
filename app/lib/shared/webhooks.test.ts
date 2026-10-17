import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextActionFor, WEBHOOK_EVENTS } from "./webhooks.ts";

describe("nextActionFor", () => {
  it("al crearse el acuerdo le toca al proveedor aceptar, y solo él debe reaccionar", () => {
    assert.deepEqual(
      { ...nextActionFor("agreement.created", "provider"), hint: "" },
      { actor: "provider", action: "accept_agreement", youAct: true, hint: "" },
    );
    assert.equal(nextActionFor("agreement.created", "client").youAct, false);
  });

  it("recorre el ciclo: aceptar → entregar → revisar → calificar", () => {
    assert.equal(nextActionFor("agreement.accepted", "provider").action, "register_delivery");
    assert.equal(nextActionFor("agreement.delivered", "client").action, "review_delivery");
    assert.equal(nextActionFor("agreement.delivered", "client").youAct, true);
    assert.equal(nextActionFor("agreement.delivered", "provider").youAct, false);
    assert.equal(nextActionFor("agreement.approved", "provider").action, "rate");
    assert.equal(nextActionFor("agreement.approved", "client").youAct, true);
  });

  it("cuando le eligen, el proveedor sabe que debe esperar al cliente", () => {
    const next = nextActionFor("application.selected", "provider");
    assert.equal(next.actor, "client");
    assert.equal(next.youAct, false);
  });

  it("una decisión de la IA indica si pagar, revisar o nada", () => {
    assert.equal(nextActionFor("decision.created", "client", { verdict: "cumple", executed: false }).action, "approve_payment");
    assert.equal(nextActionFor("decision.created", "client", { verdict: "revisar", executed: false }).action, "review_delivery");
    assert.equal(nextActionFor("decision.created", "client", { verdict: "cumple", executed: true }).action, "none");
    assert.equal(nextActionFor("decision.created", "client", { verdict: "cumple", kind: "auto_release", executed: false }).action, "none");
  });

  it("los eventos sin acción pendiente no piden nada a nadie", () => {
    for (const type of ["ping", "agreement.cancelled", "application.rejected"] as const) {
      const next = nextActionFor(type, "client");
      assert.equal(next.action, "none");
      assert.equal(next.youAct, false);
    }
  });

  it("el catálogo no repite eventos", () => {
    assert.equal(new Set(WEBHOOK_EVENTS).size, WEBHOOK_EVENTS.length);
  });
});
