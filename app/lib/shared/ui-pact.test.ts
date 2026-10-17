import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizePacts, type Pact } from "./ui-pact.ts";

const pact = (overrides: Partial<Pact>): Pact => ({
  id: "1",
  title: "t",
  description: "d",
  amount: 10,
  days: 5,
  role: "cliente",
  counterparty: "0xabc",
  status: "Creado",
  createdAt: "hoy",
  createTx: null,
  ...overrides,
});

describe("summarizePacts", () => {
  it("sin acuerdos todo es cero", () => {
    assert.deepEqual(summarizePacts([]), { inProgress: 0, needsAction: 0, lockedMon: 0, earnedMon: 0, completed: 0 });
  });

  it("cuenta en curso, los que requieren acción, lo bloqueado y lo cobrado", () => {
    const summary = summarizePacts([
      pact({ id: "1", role: "cliente", status: "Entregado", amount: 10 }),
      pact({ id: "2", role: "cliente", status: "Creado", amount: 5 }),
      pact({ id: "3", role: "proveedor", status: "Aceptado", amount: 3 }),
      pact({ id: "4", role: "proveedor", status: "Aprobado", amount: 7 }),
      pact({ id: "5", role: "cliente", status: "Cancelado", amount: 99 }),
    ]);
    assert.equal(summary.inProgress, 3);
    assert.equal(summary.needsAction, 2);
    assert.equal(summary.lockedMon, 15);
    assert.equal(summary.earnedMon, 7);
    assert.equal(summary.completed, 1);
  });

  it("un acuerdo cancelado o aprobado no cuenta como bloqueado", () => {
    assert.equal(summarizePacts([pact({ status: "Cancelado" }), pact({ status: "Aprobado" })]).lockedMon, 0);
  });
});
