import { open } from "@/lib/server/http";
import { listSkills } from "@/lib/server/services/profiles";
import { MAX_SKILLS } from "@/lib/shared/profile";

export const GET = open(async () => ({ skills: await listSkills(), limits: { maxSkills: MAX_SKILLS } }));
