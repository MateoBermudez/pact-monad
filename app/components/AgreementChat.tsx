"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Check, ExternalLink, MessageCircle, Send, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { subscribeToChanges } from "@/lib/client/realtime";
import {
  acceptProposal,
  executeAmendment,
  fetchChat,
  proposeChange,
  rejectProposal,
  revokeSignatures,
  sendChatMessage,
  withdrawProposal,
} from "@/lib/client/chat";
import { api } from "@/lib/client/api";
import { isUserRejectedError } from "@/lib/client/escrow-wallet";
import { EXPLORER_URL } from "@/lib/shared/chain";
import type { AgreementDetailDto } from "@/lib/shared/agreements";
import type { ChatDto, MessageDto, ProposalDto, ProposalStatus } from "@/lib/shared/chat";
import { short } from "@/lib/shared/ui-pact";

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: "Esperando respuesta",
  accepted: "Aceptada",
  applied: "Aplicada en el contrato",
  rejected: "Rechazada",
  withdrawn: "Retirada",
  superseded: "Reemplazada",
  expired: "Vencida",
};

const formatDate = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
const toDateInput = (iso: string) => iso.slice(0, 10);

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la acción.";
}

type Props = {
  agreement: AgreementDetailDto;
  // Se llama cuando un cambio ya se aplicó, para recargar el acuerdo y el panel.
  onChanged: () => Promise<void>;
};

export function AgreementChat({ agreement, onChanged }: Props) {
  const [chat, setChat] = useState<ChatDto | null>(null);
  const [draft, setDraft] = useState("");
  const [proposing, setProposing] = useState(false);
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const isClient = agreement.role === "client";
  const counterpartName = agreement.counterparty.displayName ?? short(agreement.counterparty.wallet);

  const load = useCallback(async () => {
    try {
      setChat(await fetchChat(agreement.id));
    } catch (e) {
      setError(errorText(e));
    }
  }, [agreement.id]);

  useEffect(() => {
    let active = true;
    void fetchChat(agreement.id)
      .then((data) => active && setChat(data))
      .catch((e: unknown) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [agreement.id]);

  useEffect(() => subscribeToChanges(() => void load()), [load]);

  useEffect(() => {
    const total = chat?.messages.length ?? 0;
    if (total !== lastCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastCount.current = total;
  }, [chat?.messages.length]);

  // Ejecuta una acción con el mismo manejo de errores, y recarga lo que cambió.
  async function run(task: () => Promise<string | null | void>, success?: string, applied = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await task();
      if (hash) {
        await api("/api/chain/sync", { method: "POST" });
        toast.success(success ?? "Transacción confirmada", { description: `${hash.slice(0, 10)}…` });
      } else if (success) {
        toast.success(success);
      }
      await load();
      if (hash || applied) await onChanged();
    } catch (e) {
      if (!isUserRejectedError(e)) setError(errorText(e));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setDraft("");
    await run(async () => {
      await sendChatMessage(agreement.id, body);
    });
  }

  function openProposal(prefill?: ProposalDto) {
    setProposing(true);
    setAmount(prefill?.newAmountMon ?? agreement.amountMon);
    setDeadline(prefill?.newDeadline ? toDateInput(prefill.newDeadline) : "");
    setNote("");
  }

  async function submitProposal(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));
    const priceChanged = Number.isFinite(value) && value > 0 && String(value) !== agreement.amountMon;
    const deadlineIso = deadline ? new Date(`${deadline}T23:59:59`).toISOString() : undefined;
    if (!priceChanged && !deadlineIso) {
      setError("Cambia el precio o el plazo para poder proponerlo.");
      return;
    }
    await run(
      async () => {
        await proposeChange(agreement.id, {
          ...(priceChanged ? { newAmountMon: value } : {}),
          ...(deadlineIso ? { newDeadline: deadlineIso } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        setProposing(false);
      },
      "Propuesta enviada",
    );
  }

  const accept = (proposal: ProposalDto) =>
    run(
      () => acceptProposal(agreement, proposal),
      proposal.acceptMeansSigning ? "Aceptaste el cambio. El cliente enviará los fondos." : "Cambio aplicado",
    );

  const execute = (proposal: ProposalDto) =>
    run(async () => (proposal.execution ? executeAmendment(proposal.execution, agreement.contractAddress) : null), "Cambio aplicado", true);

  function acceptLabel(proposal: ProposalDto): string {
    const delta = Number(proposal.deltaMon);
    if (proposal.acceptMeansSigning) return "Aceptar y firmar";
    if (delta > 0) return `Aceptar y enviar ${proposal.deltaMon} MON`;
    if (delta < 0) return `Aceptar${isClient ? "" : " y aplicar"}`;
    return "Aceptar nuevo plazo";
  }

  function renderProposal(proposal: ProposalDto) {
    const delta = Number(proposal.deltaMon);
    const priceChanged = proposal.oldAmountMon !== proposal.newAmountMon;
    const execution = proposal.execution;
    const proposer = proposal.proposedByMe ? "Tú" : counterpartName;
    return (
      <div className="mt-2 space-y-3 rounded-2xl border-2 border-ink bg-card p-4 text-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
            <Tag className="h-3.5 w-3.5" />
            Propuesta de {proposer}
          </span>
          <span className="rounded-full bg-primary/40 px-2.5 py-0.5 text-xs font-semibold">{STATUS_LABEL[proposal.status]}</span>
        </div>
        {priceChanged && (
          <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
            {proposal.oldAmountMon} MON <ArrowRight className="h-4 w-4" /> {proposal.newAmountMon} MON
            <span className={`text-sm ${delta > 0 ? "text-warning" : "text-success"}`}>
              ({delta > 0 ? "+" : ""}
              {proposal.deltaMon})
            </span>
          </p>
        )}
        {proposal.newDeadline && (
          <p className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            Nuevo plazo: {formatDate(proposal.newDeadline)}
          </p>
        )}
        {priceChanged && (
          <p className="text-xs text-muted-foreground">
            {delta < 0
              ? `Al aplicarse, ${Math.abs(delta)} MON vuelven al cliente desde el contrato.`
              : `Al aplicarse, el cliente envía ${delta} MON adicionales al contrato.`}
          </p>
        )}
        {(proposal.status === "pending" || proposal.status === "accepted") && (
          <p className="text-xs text-muted-foreground">Vigente hasta {formatDate(proposal.expiresAt)}</p>
        )}

        {proposal.status === "pending" && proposal.canAccept && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary h-10 px-4 py-0 text-xs" disabled={busy} onClick={() => void accept(proposal)}>
              <Check className="h-4 w-4" />
              {acceptLabel(proposal)}
            </button>
            <button type="button" className="btn-secondary h-10 px-4 py-0 text-xs" disabled={busy} onClick={() => openProposal(proposal)}>
              Contraofertar
            </button>
            <button
              type="button"
              className="btn-secondary h-10 px-4 py-0 text-xs"
              disabled={busy}
              onClick={() => void run(() => rejectProposal(agreement.id, proposal.id), "Propuesta rechazada")}
            >
              <X className="h-4 w-4" />
              Rechazar
            </button>
          </div>
        )}
        {proposal.status === "pending" && proposal.canWithdraw && (
          <button
            type="button"
            className="btn-secondary h-10 px-4 py-0 text-xs"
            disabled={busy}
            onClick={() => void run(() => withdrawProposal(agreement.id, proposal.id), "Propuesta retirada")}
          >
            Retirar propuesta
          </button>
        )}
        {proposal.status === "accepted" && execution?.youExecute && (
          <div className="space-y-2">
            <p className="text-sm">
              {BigInt(execution.valueWei) > BigInt(0)
                ? `Falta un paso: envía ${proposal.deltaMon} MON al contrato para aplicar el nuevo precio.`
                : "Falta un paso: confirma en tu wallet para aplicar el cambio."}
            </p>
            <button type="button" className="btn-primary h-10 px-4 py-0 text-xs" disabled={busy} onClick={() => void execute(proposal)}>
              {BigInt(execution.valueWei) > BigInt(0) ? `Enviar ${proposal.deltaMon} MON` : "Aplicar cambio"}
            </button>
          </div>
        )}
        {proposal.status === "accepted" && !execution?.youExecute && (
          <p className="text-sm text-muted-foreground">Esperando a que la otra parte confirme la transacción.</p>
        )}
        {proposal.status === "accepted" && proposal.canRevokeOnChain && (
          <button
            type="button"
            className="text-xs underline"
            disabled={busy}
            onClick={() => void run(() => revokeSignatures(agreement.chainAgreementId, agreement.contractAddress), "Firmas revocadas", true)}
          >
            Anular las firmas pendientes en la cadena
          </button>
        )}
        {proposal.status === "applied" && proposal.appliedTx && (
          <a
            href={`${EXPLORER_URL}/tx/${proposal.appliedTx}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs underline"
          >
            Ver transacción
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  function renderMessage(message: MessageDto) {
    if (message.kind === "system") {
      return (
        <p key={message.id} className="mx-auto max-w-[90%] rounded-full bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
          {message.body}
        </p>
      );
    }
    return (
      <div key={message.id} className={`flex flex-col ${message.mine ? "items-end" : "items-start"}`}>
        <div
          className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm sm:max-w-[80%] ${
            message.mine ? "bg-ink text-primary" : "border border-ink/25 bg-card text-foreground"
          }`}
        >
          {message.body}
        </div>
        {message.proposal && <div className="w-full max-w-[90%] sm:max-w-[80%]">{renderProposal(message.proposal)}</div>}
        <span className="mt-1 text-[11px] text-muted-foreground">
          {message.mine ? "Tú" : counterpartName} · {formatTime(message.createdAt)}
        </span>
      </div>
    );
  }

  return (
    <section className="card space-y-4 border-2 border-ink" aria-label="Conversación del acuerdo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <MessageCircle className="h-5 w-5" />
          Conversación con {counterpartName}
        </h2>
        {chat?.canPropose && !proposing && (
          <button type="button" className="btn-secondary h-10 px-4 py-0 text-xs" disabled={busy} onClick={() => openProposal()}>
            <Tag className="h-4 w-4" />
            Proponer cambio de precio o plazo
          </button>
        )}
      </div>

      <div ref={listRef} className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl bg-muted/40 p-3 sm:p-4" aria-live="polite">
        {!chat && <p className="text-sm text-muted-foreground">Cargando conversación…</p>}
        {chat && chat.messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aquí pueden aclarar el alcance, intercambiar ideas y renegociar el precio o el plazo. Los cambios aceptados se
            aplican directamente en el contrato.
          </p>
        )}
        {chat?.messages.map(renderMessage)}
      </div>

      {proposing && (
        <form onSubmit={(event) => void submitProposal(event)} className="space-y-3 rounded-2xl border-2 border-ink p-4">
          <h3 className="font-bold">Proponer un cambio</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              Nuevo precio (MON)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border p-3"
                aria-describedby="proposal-price-help"
              />
              <span id="proposal-price-help" className="text-xs text-muted-foreground">
                Hoy: {agreement.amountMon} MON.{" "}
                {isClient ? "Si sube, tú envías la diferencia." : "Si baja, la diferencia vuelve al cliente."}
              </span>
            </label>
            <label className="block space-y-1 text-sm">
              Nuevo plazo (opcional)
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-xl border p-3" />
              <span className="text-xs text-muted-foreground">Hoy: {formatDate(agreement.deadline)}</span>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            Mensaje (opcional)
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Cuéntale por qué propones este cambio"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Firmarás la propuesta con tu wallet (sin gas). Solo se aplica si la otra parte la acepta antes de que venza.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary h-10 px-4 py-0 text-xs" disabled={busy}>
              Firmar y enviar propuesta
            </button>
            <button type="button" className="btn-secondary h-10 px-4 py-0 text-xs" disabled={busy} onClick={() => setProposing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          {error}
        </p>
      )}

      {chat && !chat.canPost ? (
        <p className="text-center text-sm text-muted-foreground">Este acuerdo ya terminó: la conversación quedó de solo lectura.</p>
      ) : (
        <form onSubmit={(event) => void submitMessage(event)} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-draft">
            Escribe un mensaje
          </label>
          <textarea
            id="chat-draft"
            rows={2}
            maxLength={2000}
            value={draft}
            disabled={!chat}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escribe un mensaje… (Enter para enviar)"
            className="min-h-12 w-full resize-none rounded-xl border p-3 text-sm"
          />
          <button className="btn-primary h-12 px-4 py-0" disabled={busy || !draft.trim()} aria-label="Enviar mensaje">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </section>
  );
}
