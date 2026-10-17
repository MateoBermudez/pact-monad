"use client";
import Image from "next/image";
import { useState } from "react";
import { Check, Clock3, Copy, Layers3 } from "lucide-react";
import { usePact, short } from "@/lib/client/pact-context";
import type { ProfileDto } from "@/lib/shared/profile";
import { messageOf } from "./Workspace";
import "@/app/account-wallet.css";

export function AccountWallet({ profile, onConnected }: { profile: ProfileDto; onConnected: () => void }) {
  const { address, connected, connectWallet } = usePact();
  const [verifiedAddress, setVerifiedAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const wallet = profile.wallet || verifiedAddress || (connected ? address : "");
  const verified = Boolean(profile.wallet || verifiedAddress);
  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
    } catch {
      setError("No se pudo copiar. Puedes seleccionar la dirección que aparece debajo.");
    }
  }
  return <section className="workspace-card account-wallet" aria-labelledby="account-wallet-title">
    <div className="account-wallet-heading">
      <h2 id="account-wallet-title">Tu wallet</h2>
      <span className={`account-wallet-status ${verified ? "is-verified" : ""}`}>
        {verified ? <Check size={14} /> : <Clock3 size={14} />}{verified ? "Verificada" : "Por verificar"}
      </span>
    </div>
    <div className="account-wallet-stack">
      <div className="account-wallet-pass">
        <div className="account-wallet-brand"><span><Image unoptimized src="/pact-logo.svg" alt="" width={32} height={32} /> PACT</span><small>MONAD TESTNET</small></div>
        <div className="account-wallet-address">
          <span>WALLET PERSONAL</span>
          <strong title={wallet || undefined}>{wallet ? short(wallet) : "Sin conectar"}</strong>
        </div>
        <div className="account-wallet-holder"><span>TITULAR</span><strong>{profile.displayName || (profile.username ? `@${profile.username}` : "Tu cuenta PACT")}</strong></div>
        <Image unoptimized className="account-wallet-emblem" src="/pact-logo.svg" alt="" aria-hidden="true" width={150} height={150} />
        <span className="account-wallet-connect"><Layers3 size={22} /> PACT CONNECT</span>
      </div>
    </div>
    <p className="account-wallet-caption">{verified ? "Tu wallet está vinculada a tu cuenta." : "Verifica tu wallet para vincularla a tu cuenta."}</p>
    <div className="account-wallet-actions">
      <button type="button" className="btn-primary" disabled={busy || (verified && connected)} onClick={async () => {
        setBusy(true); setError("");
        try {
          const linked = await connectWallet();
          setVerifiedAddress(linked);
          onConnected();
        } catch (e) { setError(messageOf(e)); }
        finally { setBusy(false); }
      }}>{busy ? "Verificando…" : verified ? connected ? "Wallet verificada" : "Conectar wallet" : wallet ? "Verificar wallet" : "Conectar y verificar"}</button>
      <button type="button" className="btn-secondary" disabled={!wallet || busy} onClick={() => void copy()}><Copy size={16} /> Copiar dirección</button>
    </div>
    <small className="account-wallet-help">{verified ? "La vinculación ya está verificada. Las transacciones se confirman en tu wallet." : "La verificación solicita una firma, no un pago."}</small>
    {wallet && <details className="account-wallet-full"><summary>Ver dirección completa</summary><p>{wallet}</p></details>}
    {copied && <small role="status">Dirección copiada.</small>}
    {error && <p role="alert" className="auth-error">{error}</p>}
  </section>;
}
