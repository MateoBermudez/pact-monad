import { authed } from "@/lib/server/http";
import { listMyApplications } from "@/lib/server/services/applications";

export const GET = authed(async ({ user }) => ({ applications: await listMyApplications(user) }));
