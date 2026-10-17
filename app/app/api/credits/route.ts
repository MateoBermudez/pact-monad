import { authed } from "@/lib/server/http";
import { creditsSummary } from "@/lib/server/services/credits";

export const GET = authed(async ({ user }) => ({ credits: await creditsSummary(user.id) }));
