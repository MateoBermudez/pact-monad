import { open } from "@/lib/server/http";
import { listSkills } from "@/lib/server/services/profiles";

export const GET = open(async () => ({ skills: await listSkills() }));
