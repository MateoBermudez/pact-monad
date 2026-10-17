import "client-only";
import type { Eip1193Provider } from "ethers";
import { postJson } from "@/lib/client/api";
import { connectWallet } from "@/lib/client/wallet";
import type {
  IdentityDto,
  OAuthProvider,
  SessionUser,
} from "@/lib/shared/auth";

type InjectedProvider = Eip1193Provider & {
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

export class SignInCancelledError extends Error {
  constructor() {
    super("Cancelaste la firma. Puedes intentarlo de nuevo cuando quieras.");
  }
}

const USER_REJECTED_CODE = 4001;

function isRejection(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === USER_REJECTED_CODE || code === "ACTION_REJECTED";
}

// Compatibility entry point: wallet linking never creates a new login.
export async function signInWithWallet(): Promise<SessionUser> {
  try {
    return (await linkWalletToAccount()).user;
  } catch (error) {
    if (isRejection(error)) throw new SignInCancelledError();
    throw error;
  }
}

export function oauthStartUrl(
  provider: OAuthProvider,
  options: { next?: string; link?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (options.next) params.set("next", options.next);
  if (options.link) params.set("link", "1");
  const query = params.toString();
  return `/api/auth/oauth/${provider}${query ? `?${query}` : ""}`;
}

export async function fetchIdentities(): Promise<IdentityDto[]> {
  const res = await fetch("/api/auth/identities");
  if (!res.ok) throw new Error(`/api/auth/identities respondió ${res.status}`);
  return ((await res.json()) as { identities: IdentityDto[] }).identities;
}

export async function linkWalletToAccount(): Promise<{
  user: SessionUser;
  merged: boolean;
}> {
  const session = await ensureSession();
  const { signer, address } = await connectWallet({ linking: true });
  if (
    session.wallet &&
    session.wallet.toLowerCase() !== address.toLowerCase()
  ) {
    throw new Error(
      "Selecciona en MetaMask la wallet que ya está vinculada a tu cuenta.",
    );
  }
  const { message } = await postJson<{ message: string }>("/api/auth/nonce", {
    address,
  });
  const signature = await signer.signMessage(message);
  return postJson<{ user: SessionUser; merged: boolean }>("/api/auth/wallet", {
    address,
    signature,
  });
}

export async function fetchSession(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/api/auth/me respondió ${res.status}`);
  return ((await res.json()) as { user: SessionUser }).user;
}

// Social authentication is required before any wallet interaction.
export async function ensureSession(): Promise<SessionUser> {
  const session = await fetchSession();
  if (!session)
    throw new Error(
      "Inicia sesión con Google o GitHub antes de conectar tu wallet.",
    );
  return session;
}

// Avisa cuando la persona cambia de cuenta en MetaMask. Devuelve la función para dejar de escuchar.
export function watchWalletAccount(
  onChange: (account: string | null) => void,
): () => void {
  const ethereum = window.ethereum as InjectedProvider | undefined;
  if (!ethereum?.on) return () => undefined;

  const handler = (accounts: unknown) =>
    onChange(
      Array.isArray(accounts) && typeof accounts[0] === "string"
        ? accounts[0].toLowerCase()
        : null,
    );
  ethereum.on("accountsChanged", handler);
  return () => ethereum.removeListener?.("accountsChanged", handler);
}

export async function signOut(): Promise<void> {
  await postJson("/api/auth/logout", {});
}
