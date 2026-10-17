import "server-only";
import { query } from "@/lib/server/db";
import type { OnboardingStatus, SessionUser } from "@/lib/shared/auth";

export async function getOnboardingStatus(user: SessionUser): Promise<OnboardingStatus> {
  const [row] = await query<{ skills: number }>("select count(*)::int as skills from user_skills where user_id = $1", [
    user.id,
  ]);
  const needsUsername = user.username === null;
  const needsSkills = row.skills === 0;
  return { needsUsername, needsSkills, complete: !needsUsername && !needsSkills };
}
