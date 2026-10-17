// Lo que las partes firman para renegociar un acuerdo en curso. Debe coincidir exactamente con `amendAgreement` en
// contracts/src/PactEscrow.sol (EIP-712): lo usan el navegador para firmar y el servidor para verificar.
export const AMENDMENT_DOMAIN_NAME = "PactEscrow";
export const AMENDMENT_DOMAIN_VERSION = "1";

export const AMENDMENT_TYPES = {
  Amendment: [
    { name: "id", type: "uint256" },
    { name: "newAmount", type: "uint256" },
    { name: "newDeadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint64" },
  ],
};

// Todos los números viajan como texto decimal para no perder precisión (importes en wei).
export type AmendmentTerms = {
  id: string;
  newAmount: string;
  // 0 conserva el plazo del acuerdo.
  newDeadline: string;
  nonce: string;
  expiry: string;
};

export type AmendmentDomain = { name: string; version: string; chainId: number; verifyingContract: string };

export type AmendmentTypedData = {
  domain: AmendmentDomain;
  types: typeof AMENDMENT_TYPES;
  message: AmendmentTerms;
};

export function amendmentTypedData(args: { chainId: number; contract: string; terms: AmendmentTerms }): AmendmentTypedData {
  return {
    domain: {
      name: AMENDMENT_DOMAIN_NAME,
      version: AMENDMENT_DOMAIN_VERSION,
      chainId: args.chainId,
      verifyingContract: args.contract,
    },
    types: AMENDMENT_TYPES,
    message: args.terms,
  };
}
