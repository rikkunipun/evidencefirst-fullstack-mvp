import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "./capability";

/**
 * Participant authorization: the signed cookie must name exactly this
 * session ID. An ID alone (e.g. guessed from a URL) never grants access —
 * only a valid signature over that ID does.
 */
export async function requireSessionAccess(sessionId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const verifiedSessionId = verifySessionCookie(raw);
  return verifiedSessionId === sessionId;
}
