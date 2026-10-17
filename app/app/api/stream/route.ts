import { authed } from "@/lib/server/http";
import { loadChangeVersion } from "@/lib/server/services/dashboard";
import { syncAndProcess } from "@/lib/server/services/sync";

const POLL_MS = 2_000;
const PING_MS = 15_000;
// El navegador reconecta solo (EventSource); cerrar cada tanto evita conexiones colgadas y respeta los límites de hosting.
const MAX_STREAM_MS = 4 * 60_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });
}

// Canal de tiempo real: avisa con "change" cuando algo de la persona cambió; el cliente vuelve a pedir /api/dashboard.
export const GET = authed(async ({ request, user }) => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        let last = await loadChangeVersion(user.id);
        send(`retry: 3000\nevent: ready\ndata: ${JSON.stringify({ version: last })}\n\n`);

        const startedAt = Date.now();
        let lastSentAt = Date.now();
        while (!request.signal.aborted && Date.now() - startedAt < MAX_STREAM_MS) {
          await sleep(POLL_MS, request.signal);
          if (request.signal.aborted) break;
          try {
            await syncAndProcess();
            const version = await loadChangeVersion(user.id);
            if (version !== last) {
              last = version;
              send(`event: change\ndata: ${JSON.stringify({ version })}\n\n`);
              lastSentAt = Date.now();
            } else if (Date.now() - lastSentAt > PING_MS) {
              send(": ping\n\n");
              lastSentAt = Date.now();
            }
          } catch (error) {
            console.error("[stream]", error);
          }
        }
        controller.close();
      } catch (error) {
        console.error("[stream] no se pudo abrir:", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
