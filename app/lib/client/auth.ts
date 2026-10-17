import "client-only";
import { connectWallet } from "@/lib/client/wallet";
import type { SessionUser } from "@/lib/shared/auth";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} respondió ${res.status}`);
  return (await res.json()) as T;
}

// Conecta MetaMask, cambia a Monad Testnet, firma el reto del servidor y abre sesión. Firmar no cuesta gas.
export async function signInWithWallet(): Promise<SessionUser> {
  const { signer, address } = await connectWallet();
  const { message } = await postJson<{ message: string }>("/api/auth/nonce", { address });
  const signature = await signer.signMessage(message);
  const { user } = await postJson<{ user: SessionUser }>("/api/auth/verify", { address, signature });
  return user;
}

export async function fetchSession(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/api/auth/me respondió ${res.status}`);
  return ((await res.json()) as { user: SessionUser }).user;
}

export async function signOut(): Promise<void> {
  await postJson("/api/auth/logout", {});
}
