import { open } from "@/lib/server/http";
import { listSkills } from "@/lib/server/services/profiles";
import { MAX_KEYWORDS } from "@/lib/shared/keywords";
import { MAX_LINKS, MAX_SKILLS } from "@/lib/shared/profile";

export const GET = open(async () => ({ skills: await listSkills(), limits: { maxSkills: MAX_SKILLS, maxKeywords: MAX_KEYWORDS, maxLinks: MAX_LINKS } }));
