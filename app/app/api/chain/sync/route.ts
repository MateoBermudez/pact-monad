import { authed } from "@/lib/server/http";
import { syncAndProcess } from "@/lib/server/services/sync";

export const POST = authed(async () => syncAndProcess({ force: true }));
