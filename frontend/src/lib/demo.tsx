import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  connectMetaMask,
  getChainId,
  getEthereum,
  getWalletBalanceMon,
  MONAD_CHAIN_ID,
  switchToMonadTestnet,
} from "@/lib/wallet";

export const CLIENT = "0x71C0a9b2c4d1e8f3a6b5c7d9e0f1a2b3c4d528E4";
export const PROVIDER = "0x3DE8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6fA88";
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const EXPLORER = "https://testnet.monadexplorer.com/tx/0x9f2c3a1b";

export type Role = "cliente" | "proveedor";
export type Status = "Creado" | "Aceptado" | "Entregado" | "Aprobado" | "Cancelado";

export type Pact = {
  id: string;
  title: string;
  description: string;
  amount: number;
  days: number;
  role: Role;
  counterparty: string;
  status: Status;
  createdAt: string;
};

const SEED: Pact[] = [
  { id: "1", title: "Logo para una cafetería", description: "Logo para una cafetería, entrega en PNG y SVG. Debe incluir versión a color y en blanco y negro, apta para redes sociales y señalética.", amount: 10, days: 7, role: "cliente", counterparty: PROVIDER, status: "Entregado", createdAt: "15 oct 2026" },
  { id: "2", title: "Landing page para app de fitness", description: "Landing responsive con 4 secciones y formulario de contacto.", amount: 45, days: 14, role: "cliente", counterparty: "0x9A1f4e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7E21", status: "Aceptado", createdAt: "12 oct 2026" },
  { id: "3", title: "Traducción de whitepaper al inglés", description: "Traducir 20 páginas del whitepaper del español al inglés.", amount: 20, days: 5, role: "proveedor", counterparty: "0x5B7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3aC03", status: "Creado", createdAt: "14 oct 2026" },
  { id: "4", title: "Ilustraciones para NFT", description: "Serie de 10 ilustraciones en estilo pixel art.", amount: 30, days: 10, role: "proveedor", counterparty: "0x2C4d6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a4bD9F1", status: "Aprobado", createdAt: "02 oct 2026" },
  { id: "5", title: "Auditoría de smart contract", description: "Revisión de seguridad de un contrato de staking.", amount: 60, days: 7, role: "cliente", counterparty: "0x8E0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2dB7A2", status: "Cancelado", createdAt: "28 sep 2026" },
];

/** A payment that just landed in the user's wallet; drives the live "money arrived" animation. */
export type Incoming = { key: number; amount: number; from: string; title: string };

type Demo = {
  /** Active wallet address (real MetaMask address when connected). */
  address: string;
  /** Wallet balance in MON. */
  balance: number;
  incoming: Incoming | null;
  dismissIncoming: () => void;
  /** Simulates a payment arriving in real time. `createPact` also records it in the dashboard. */
  receive: (amount: number, from: string, title: string, createPact?: boolean) => void;
  connected: boolean;
  setConnected: (v: boolean) => void;
  /** Connects real MetaMask wallet and switches to Monad Testnet. */
  connectWallet: () => Promise<string>;
  /** Switches real MetaMask network to Monad Testnet. */
  switchNetwork: () => Promise<void>;
  wrongNetwork: boolean;
  setWrongNetwork: (v: boolean) => void;
  aiFail: boolean;
  setAiFail: (v: boolean) => void;
  pacts: Pact[];
  addPact: (p: Omit<Pact, "id" | "createdAt" | "status" | "role">) => string;
  updatePact: (id: string, patch: Partial<Pact>) => void;
  /** When on, the AI may release payments up to `aiLimit` MON without the client's signature. */
  aiAutoApprove: boolean;
  setAiAutoApprove: (v: boolean) => void;
  aiLimit: number;
  setAiLimit: (v: number) => void;
};

/** Upper bound of the settings slider, in MON. */
export const AI_LIMIT_MAX = 100;

/** Whether the AI can release this amount on its own under the given settings. */
export const aiCanRelease = (amount: number, autoApprove: boolean, limit: number) => autoApprove && amount <= limit;

const Ctx = createContext<Demo | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState(CLIENT);
  const [connected, setConnected] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [aiFail, setAiFail] = useState(false);
  const [pacts, setPacts] = useState<Pact[]>(SEED);
  const [aiAutoApprove, setAiAutoApprove] = useState(true);
  const [aiLimit, setAiLimit] = useState(25);
  const [balance, setBalance] = useState(120);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const keyRef = useRef(0);

  const connectWallet = useCallback(async () => {
    const res = await connectMetaMask();
    setAddress(res.address);
    setConnected(true);
    setWrongNetwork(res.chainId !== MONAD_CHAIN_ID);
    setBalance(res.balance);
    return res.address;
  }, []);

  const switchNetwork = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setWrongNetwork(false);
      return;
    }
    await switchToMonadTestnet(ethereum);
    const cid = await getChainId(ethereum);
    setWrongNetwork(cid !== null && cid !== MONAD_CHAIN_ID);
    if (address) {
      const bal = await getWalletBalanceMon(address, ethereum);
      setBalance(bal);
    }
  }, [address]);

  // Sync with real MetaMask accounts and chain on mount + events
  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    let active = true;
    (async () => {
      try {
        const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
        const acc = accounts?.[0];
        if (!active || !acc) return;
        setAddress(acc);
        setConnected(true);
        const cid = await getChainId(ethereum);
        if (active && cid !== null) {
          setWrongNetwork(cid !== MONAD_CHAIN_ID);
        }
        const bal = await getWalletBalanceMon(acc, ethereum);
        if (active) {
          setBalance(bal);
        }
      } catch {
        // Ignore silent probe errors
      }
    })();

    const onAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      const acc = list[0];
      if (!acc) {
        setConnected(false);
        setAddress(CLIENT);
        return;
      }
      setAddress(acc);
      setConnected(true);
      void getWalletBalanceMon(acc, ethereum).then(setBalance);
    };

    const onChainChanged = (chainIdHex: unknown) => {
      if (typeof chainIdHex === "string") {
        const cid = Number.parseInt(chainIdHex, 16);
        setWrongNetwork(cid !== MONAD_CHAIN_ID);
      }
    };

    ethereum.on?.("accountsChanged", onAccountsChanged);
    ethereum.on?.("chainChanged", onChainChanged);
    return () => {
      active = false;
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const dismissIncoming = useCallback(() => setIncoming(null), []);
  const receive: Demo["receive"] = useCallback((amount, from, title, createPact = true) => {
    setBalance((b) => +(b + amount).toFixed(2));
    setIncoming({ key: ++keyRef.current, amount, from, title });
    if (createPact) {
      setPacts((prev) => {
        const id = String(Math.max(0, ...prev.map((x) => Number(x.id))) + 1);
        const createdAt = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
        return [{ id, title, description: title, amount, days: 3, role: "proveedor", counterparty: from, status: "Aprobado", createdAt }, ...prev];
      });
    }
    try { navigator.vibrate?.([30, 40, 30]); } catch { /* not supported */ }
  }, []);

  const addPact: Demo["addPact"] = (p) => {
    const id = String(Math.max(0, ...pacts.map((x) => Number(x.id))) + 1);
    const createdAt = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    setPacts((prev) => [{ ...p, id, createdAt, status: "Creado", role: "cliente" }, ...prev]);
    setBalance((b) => Math.max(0, +(b - p.amount).toFixed(4)));
    return id;
  };
  const updatePact: Demo["updatePact"] = (id, patch) =>
    setPacts((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <Ctx.Provider
      value={{
        address,
        connected,
        setConnected,
        connectWallet,
        switchNetwork,
        wrongNetwork,
        setWrongNetwork,
        aiFail,
        setAiFail,
        pacts,
        addPact,
        updatePact,
        aiAutoApprove,
        setAiAutoApprove,
        aiLimit,
        setAiLimit,
        balance,
        incoming,
        dismissIncoming,
        receive,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("DemoProvider missing");
  return c;
}

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export const STATUS_BADGE: Record<Status, string> = {
  Creado: "bg-muted text-muted-foreground",
  Aceptado: "bg-primary text-primary-foreground",
  Entregado: "bg-warning/15 text-warning",
  Aprobado: "bg-success/15 text-success",
  Cancelado: "bg-destructive/15 text-destructive",
};
