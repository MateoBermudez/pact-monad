import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TypedDataEncoder, verifyTypedData, Wallet } from "ethers";
import { AMENDMENT_TYPES, amendmentTypedData, type AmendmentTerms } from "./amendment.ts";

const contract = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const terms: AmendmentTerms = { id: "1", newAmount: "40000000000000000000", newDeadline: "0", nonce: "0", expiry: "1800000000" };

describe("amendmentTypedData", () => {
  it("fija el dominio del contrato y la red, para que una firma no valga en otro contrato", () => {
    const typed = amendmentTypedData({ chainId: 10143, contract, terms });
    assert.deepEqual(typed.domain, { name: "PactEscrow", version: "1", chainId: 10143, verifyingContract: contract });
    assert.equal(TypedDataEncoder.from(AMENDMENT_TYPES).primaryType, "Amendment");
  });

  it("la firma solo verifica con los mismos términos y el mismo contrato", async () => {
    const signer = Wallet.createRandom();
    const typed = amendmentTypedData({ chainId: 10143, contract, terms });
    const signature = await signer.signTypedData(typed.domain, typed.types, typed.message);

    assert.equal(verifyTypedData(typed.domain, typed.types, typed.message, signature), signer.address);

    const raised = amendmentTypedData({ chainId: 10143, contract, terms: { ...terms, newAmount: "90000000000000000000" } });
    assert.notEqual(verifyTypedData(raised.domain, raised.types, raised.message, signature), signer.address);

    const elsewhere = amendmentTypedData({ chainId: 10143, contract: "0x0000000000000000000000000000000000000001", terms });
    assert.notEqual(verifyTypedData(elsewhere.domain, elsewhere.types, elsewhere.message, signature), signer.address);
  });
});
