"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isAddress, parseEther, formatEther, ZeroAddress } from "ethers";
import {
  Workspace,
  useResource,
  LoadState,
  Metric,
  messageOf,
} from "@/components/Workspace";
import { api, jsonRequest } from "@/lib/client/api";
import { connectWallet as getSigner } from "@/lib/client/wallet";
import { usePact } from "@/lib/client/pact-context";
import { EXPLORER_URL } from "@/lib/shared/chain";
import type { CreditsSummary } from "@/lib/shared/credits";
export default function Credits() {
  const state = useResource<{ credits: CreditsSummary }>("/api/credits");
  const credits = state.data?.credits;
  const { connected, connectWallet } = usePact();
  const [quantity, setQuantity] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState("");
  const [ack, setAck] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        try {
          setHash(sessionStorage.getItem("pact:credit-purchase") ?? "");
        } catch {
          /* Optional browser persistence. */
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const valid =
    !!credits &&
    isAddress(credits.treasuryAddress) &&
    credits.treasuryAddress !== ZeroAddress &&
    Number(credits.priceMonPerCredit) > 0 &&
    Number.isInteger(Number(quantity)) &&
    Number(quantity) > 0 &&
    Number(quantity) <= 10000;
  const total =
    credits && valid
      ? parseEther(credits.priceMonPerCredit) * BigInt(Number(quantity))
      : BigInt(0);
  async function claim() {
    await api(
      "/api/credits/purchase",
      jsonRequest("POST", { txHash: hash.trim() }),
    );
    await state.reload();
    setNotice("Compra verificada. Los créditos ya están disponibles.");
    setHash("");
    try {
      sessionStorage.removeItem("pact:credit-purchase");
    } catch {
      /* Optional browser persistence. */
    }
    setAck(false);
  }
  return (
    <Workspace
      title="Dale impulso a tus ideas."
      intro="Los créditos se usan para estructurar acuerdos y revisar entregas con IA."
    >
      <LoadState {...state} retry={state.reload} />
      {credits && (
        <>
          <div className="workspace-banner">
            <div>
              <span>Tu saldo de IA</span>
              <strong className="workspace-big-number">
                {credits.balance}
              </strong>
              <h2>créditos disponibles</h2>
              <p>
                Recibes {credits.monthlyFreeCredits} créditos gratuitos al mes.
              </p>
            </div>
            <div className="workspace-credit-costs">
              <Metric
                value={credits.costs.structure}
                label="Estructurar texto"
              />
              <Metric
                value={credits.costs.structureWithFile}
                label="Estructurar con archivo"
              />
              <Metric value={credits.costs.review} label="Revisar entrega" />
            </div>
          </div>
          <div className="workspace-split">
            <form
              className="workspace-card workspace-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!valid || busy || hash || !ack) return;
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  if (!connected) await connectWallet();
                  const { signer } = await getSigner();
                  const tx = await signer.sendTransaction({
                    to: credits.treasuryAddress,
                    value: total,
                  });
                  setHash(tx.hash);
                  try {
                    sessionStorage.setItem("pact:credit-purchase", tx.hash);
                  } catch {
                    /* Optional browser recovery. */
                  }
                  const receipt = await tx.wait();
                  if (!receipt || receipt.status !== 1)
                    throw new Error(
                      "El pago no se confirmó. Comprueba la transacción antes de volver a pagar.",
                    );
                  await api(
                    "/api/credits/purchase",
                    jsonRequest("POST", { txHash: tx.hash }),
                  );
                  await state.reload();
                  setNotice("Créditos acreditados.");
                  setHash("");
                  try {
                    sessionStorage.removeItem("pact:credit-purchase");
                  } catch {
                    /* Optional browser persistence. */
                  }
                } catch (e) {
                  setError(messageOf(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Recargar créditos</h2>
              <p>{credits.priceMonPerCredit} MON por crédito · Monad Testnet</p>
              <label>
                Cuántos créditos
                <input
                  required
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={quantity}
                  disabled={busy || !!hash}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <p className="workspace-total">{formatEther(total)} MON</p>
              <p className="workspace-code">
                Destino:{" "}
                {credits.treasuryAddress || "Tesorería pendiente de configurar"}
              </p>
              <label className="workspace-checkbox">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                Revisé el importe y el destino del pago en MON de prueba.
              </label>
              <button
                className="btn-primary"
                disabled={!valid || busy || !!hash || !ack}
              >
                {busy ? "Esperando confirmación…" : "Pagar con mi wallet"}
              </button>
              {!isAddress(credits.treasuryAddress) && (
                <p className="field-help">
                  La recarga estará disponible cuando se configure la tesorería.
                </p>
              )}
            </form>
            <form
              className="workspace-card workspace-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  await claim();
                } catch (e) {
                  setError(messageOf(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>¿Ya pagaste?</h2>
              <p>
                Si el pago se confirmó y no ves tus créditos, verifica la misma
                transacción. No necesitas volver a pagar.
              </p>
              <label>
                Hash de la transacción
                <input
                  required
                  pattern="0x[0-9a-fA-F]{64}"
                  value={hash}
                  disabled={busy}
                  onChange={(e) => setHash(e.target.value)}
                  placeholder="0x…"
                />
              </label>
              {hash && (
                <a
                  href={`${EXPLORER_URL}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver en explorer ↗
                </a>
              )}
              <button
                className="btn-secondary"
                disabled={busy || !/^0x[0-9a-f]{64}$/i.test(hash)}
              >
                Verificar y acreditar
              </button>
              <button
                type="button"
                className="workspace-text-button"
                onClick={() => {
                  try {
                    setHash(
                      sessionStorage.getItem("pact:credit-purchase") ?? "",
                    );
                  } catch {
                    setError("No se pudo recuperar el pago de este navegador.");
                  }
                }}
              >
                Recuperar último pago de este navegador
              </button>
              <Link href="/crear">Crear un acuerdo ↗</Link>
            </form>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="workspace-notice">
          {notice}
        </p>
      )}
    </Workspace>
  );
}
