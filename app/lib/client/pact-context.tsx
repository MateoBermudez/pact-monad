"use client";
import "client-only";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPublicPath, LOGIN_PATH } from "@/lib/shared/routes";
import { api, ApiRequestError } from "./api";
import { subscribeToChanges } from "./realtime";
import {
  linkWalletToAccount,
  fetchSession,
  signOut,
  watchWalletAccount,
} from "./auth";
import {
  connectMetaMask,
  getWalletBalanceMon,
  MONAD_CHAIN_ID,
  switchToMonadTestnet,
} from "./escrow-wallet";
import { toPact, type Pact } from "@/lib/shared/ui-pact";
import type { AgreementDto, DashboardDto } from "@/lib/shared/agreements";
import type { SessionUser } from "@/lib/shared/auth";
export {
  short,
  addDays,
  STATUS_BADGE,
  aiCanRelease,
} from "@/lib/shared/ui-pact";
export type { Role, Status, Pact } from "@/lib/shared/ui-pact";
type State = {
  address: string;
  connected: boolean;
  signedIn: boolean;
  loading: boolean;
  error: string | null;
  balance: number;
  wrongNetwork: boolean;
  pacts: Pact[];
  aiAutoApprove: boolean;
  aiLimit: number;
  changes: number;
  setConnected: (value: boolean) => void;
  connectWallet: () => Promise<string>;
  switchNetwork: () => Promise<void>;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<Pact[]>;
};
const Context = createContext<State | null>(null);
export function PactProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [address, setAddress] = useState("");
  const [connected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [aiAutoApprove, setAiAutoApprove] = useState(false);
  const [aiLimit, setAiLimit] = useState(0);
  const [changes, setChanges] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const [{ agreements }, { dashboard }] = await Promise.all([
        api<{ agreements: AgreementDto[] }>("/api/agreements"),
        api<{ dashboard: DashboardDto }>("/api/dashboard"),
      ]);
      const items = agreements.map(toPact);
      setPacts(items);
      setError(null);
      if (dashboard.availableMon !== null)
        setBalance(Number(dashboard.availableMon));
      setAiAutoApprove(dashboard.autoRelease.enabled);
      setAiLimit(Number(dashboard.autoRelease.limitMon));
      return items;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setUser(null);
        setPacts([]);
      }
      setError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar tus acuerdos.",
      );
      return [];
    }
  }, []);
  const connectWallet = useCallback(async () => {
    const { user: session } = await linkWalletToAccount();
    setUser(session);
    const wallet = await connectMetaMask();
    setAddress(wallet.address);
    setIsConnected(true);
    setBalance(wallet.balance);
    setWrongNetwork(wallet.chainId !== MONAD_CHAIN_ID);
    return wallet.address;
  }, []);
  const switchNetwork = useCallback(async () => {
    await switchToMonadTestnet();
    setWrongNetwork(false);
    if (address) setBalance(await getWalletBalanceMon(address));
  }, [address]);
  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setIsConnected(false);
    setAddress("");
    setBalance(0);
    setPacts([]);
  }, []);
  const signIn = useCallback(async () => {
    await connectWallet();
    await refresh();
  }, [connectWallet, refresh]);
  const setConnected = useCallback(
    (value: boolean) => {
      if (value) {
        void connectWallet().catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "No se pudo conectar."),
        );
        return;
      }
      void signOut()
        .then(() => {
          setUser(null);
          setIsConnected(false);
          setAddress("");
          setBalance(0);
          setPacts([]);
        })
        .catch((e: unknown) =>
          setError(
            e instanceof Error ? e.message : "No se pudo cerrar la sesión.",
          ),
        );
    },
    [connectWallet],
  );
  useEffect(() => {
    let active = true;
    void fetchSession()
      .then(async (session) => {
        if (!active) return;
        setUser(session);
        if (session) {
          setAddress(session.wallet ?? "");
          if (session.wallet) await refresh();
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la sesión.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    type WalletEvents = NonNullable<Window["ethereum"]> & {
      on?: (event: string, callback: (chain: unknown) => void) => void;
      removeListener?: (
        event: string,
        callback: (chain: unknown) => void,
      ) => void;
    };
    const eth = (
      typeof window === "undefined" ? undefined : window.ethereum
    ) as WalletEvents | undefined;
    const stop = watchWalletAccount(() => {
      if (!active) return;
      setAddress("");
      setIsConnected(false);
      setPacts([]);
    });
    const chainChanged = (chain: unknown) => {
      if (active && typeof chain === "string")
        setWrongNetwork(Number(chain) !== MONAD_CHAIN_ID);
    };
    eth?.on?.("chainChanged", chainChanged);
    return () => {
      active = false;
      stop();
      eth?.removeListener?.("chainChanged", chainChanged);
    };
  }, [refresh]);
  useEffect(() => {
    if (loading || user || isPublicPath(pathname)) return;
    void signOut()
      .catch(() => undefined)
      .finally(() => router.replace(LOGIN_PATH));
  }, [loading, user, pathname, router]);
  useEffect(() => {
    if (!user) return;
    const update = () => {
      setChanges((count) => count + 1);
      void refresh();
    };
    const unsubscribe = subscribeToChanges(update);
    window.addEventListener("focus", update);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", update);
    };
  }, [user, refresh]);
  return (
    <Context.Provider
      value={{
        address,
        connected,
        signedIn: !!user,
        loading,
        error,
        balance,
        wrongNetwork,
        pacts,
        aiAutoApprove,
        aiLimit,
        changes,
        setConnected,
        connectWallet,
        switchNetwork,
        signIn,
        logout,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePact() {
  const state = useContext(Context);
  if (!state) throw new Error("PactProvider missing");
  return state;
}
