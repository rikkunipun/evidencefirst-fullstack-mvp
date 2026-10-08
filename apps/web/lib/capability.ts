import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

/**
 * Participant resume/follow-up capabilities: a high-entropy random token is
 * the secret; only its SHA-256 hash is ever persisted. The raw token is
 * exchanged once for a signed HttpOnly cookie. An ID alone never grants
 * access — the hash lookup is the only authorization path.
 */

export function generateCapabilityToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Signs `sessionId` so the cookie can't be forged without SESSION_TOKEN_SECRET. */
export function signSessionCookie(sessionId: string): string {
  const secret = getEnv().SESSION_TOKEN_SECRET;
  const sig = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

export function verifySessionCookie(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const idx = cookieValue.lastIndexOf(".");
  if (idx <= 0) return null;
  const sessionId = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  const secret = getEnv().SESSION_TOKEN_SECRET;
  const expected = createHmac("sha256", secret).update(sessionId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

export const SESSION_COOKIE_NAME = "__Host-ef-session";
export const RESUME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const FOLLOWUP_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 21; // 21 days (due at +7, grace to +21)
