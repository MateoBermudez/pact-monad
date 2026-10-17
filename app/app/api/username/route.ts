import { authed, open, readJson, readQuery } from "@/lib/server/http";
import { checkUsername, setUsername } from "@/lib/server/services/username";
import { setUsernameSchema, usernameQuerySchema } from "@/lib/shared/schemas";

export const GET = open(async ({ request }) => checkUsername(readQuery(request, usernameQuerySchema).u));

export const PUT = authed(async ({ request, user }) => {
  const { username } = await readJson(request, setUsernameSchema);
  return { username: await setUsername(user.id, username) };
});
