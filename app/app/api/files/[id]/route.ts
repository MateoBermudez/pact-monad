import { optional, parseId } from "@/lib/server/http";
import { getSignedFileUrl } from "@/lib/server/services/files";

export const GET = optional<{ id: string }>(async ({ params, user }) => getSignedFileUrl(user?.id ?? null, parseId(params.id)));
