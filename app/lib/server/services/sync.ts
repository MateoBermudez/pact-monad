import "server-only";
import { after } from "next/server";
import { syncChain, type SyncResult } from "@/lib/server/chain/indexer";
import { runWorker } from "@/lib/server/services/worker";

function inBackground(task: () => Promise<unknown>): void {
  const run = () => task().catch((error) => console.error("[sync] tarea en segundo plano fallida:", error));
  try {
    after(run);
  } catch {
    void run();
  }
}

// Sincroniza con la cadena y, si llegaron eventos nuevos, deja en segundo plano la revisión de la IA y los webhooks
// pendientes para que salgan al instante. Nada de esto es la única vía: si esta función muere, el worker que llama
// Supabase (ver /api/internal/worker) retoma el trabajo desde la cola.
export async function syncAndProcess(options: { force?: boolean } = {}): Promise<SyncResult> {
  const result = await syncChain(options);
  if (result.eventsApplied > 0) inBackground(() => runWorker({ budgetMs: 25_000, sync: false }));
  return result;
}
