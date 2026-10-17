import "client-only";

const DEFAULT_POLL_MS = 5_000;
const ERRORS_BEFORE_POLLING = 3;

// Avisa cuando algo de la persona cambió para que la pantalla vuelva a pedir sus datos (por ejemplo /api/dashboard).
// Usa el canal SSE y, si no se puede mantener (sin sesión, red que corta conexiones largas o un hosting que las limita),
// pasa solo a consultar cada pocos segundos. Devuelve la función para dejar de escuchar.
export function subscribeToChanges(onChange: () => void, options: { pollMs?: number } = {}): () => void {
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let errors = 0;
  let stopped = false;

  const startPolling = () => {
    source?.close();
    source = null;
    if (!timer && !stopped) timer = setInterval(onChange, options.pollMs ?? DEFAULT_POLL_MS);
  };

  if (typeof EventSource === "undefined") {
    startPolling();
  } else {
    source = new EventSource("/api/stream");
    source.addEventListener("ready", () => {
      errors = 0;
    });
    source.addEventListener("change", () => onChange());
    source.onerror = () => {
      errors += 1;
      // EventSource reconecta solo; si falla varias veces seguidas (o se cerró del todo) es mejor consultar.
      if (source?.readyState === EventSource.CLOSED || errors >= ERRORS_BEFORE_POLLING) startPolling();
    };
  }

  return () => {
    stopped = true;
    source?.close();
    if (timer) clearInterval(timer);
  };
}
