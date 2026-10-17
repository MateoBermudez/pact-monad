"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { usePact } from "@/lib/client/pact-context";
import { useHydrated } from "@/lib/client/use-hydrated";
import { useNotifications } from "@/lib/client/use-notifications";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

export function NotificationBell() {
  const { signedIn } = usePact();
  const hydrated = useHydrated();
  const { items, unread, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!hydrated || !signedIn) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="press relative rounded-full bg-primary/30 p-2"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-ink-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="card absolute right-0 top-12 z-50 max-h-96 w-80 max-w-[90vw] space-y-2 overflow-y-auto p-3 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">Notificaciones</strong>
            {unread > 0 && (
              <button type="button" className="text-xs underline" onClick={() => void markAllRead()}>
                Marcar todo como leído
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes avisos. Te avisaremos cuando llegue una solicitud que encaje con tu perfil.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const reasons = Array.isArray(item.data.reasons) ? (item.data.reasons as string[]) : [];
                const content = (
                  <>
                    <p className={item.readAt ? "text-sm" : "text-sm font-bold"}>{item.title}</p>
                    {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                    {reasons.length > 0 && <p className="text-xs">{reasons.join(" · ")}</p>}
                    <p className="text-[10px] text-muted-foreground">{when(item.createdAt)}</p>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.listingId ? (
                      <Link
                        href={`/solicitudes/${item.listingId}`}
                        onClick={() => {
                          setOpen(false);
                          if (!item.readAt) void markRead([item.id]);
                        }}
                        className="block rounded-xl border border-ink/10 p-2 hover:bg-primary/20"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-ink/10 p-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
