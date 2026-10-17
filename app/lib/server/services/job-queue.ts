import "server-only";
import type { Queryable } from "@/lib/server/db";

export async function enqueueScreeningJob(db: Queryable, applicationId: string): Promise<void> {
  await db.query(
    `insert into jobs (kind, payload, dedupe_key) values ('screen_application', $1::jsonb, $2)
     on conflict (dedupe_key) do nothing`,
    [JSON.stringify({ applicationId }), `screen:${applicationId}`],
  );
}
