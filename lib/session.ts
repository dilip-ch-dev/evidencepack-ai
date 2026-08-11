import { createHash } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_TOKEN_PATTERN } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export class SessionUnavailableError extends Error {
  constructor() {
    super("A valid TrueCite session is required.");
    this.name = "SessionUnavailableError";
  }
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionToken() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) {
    throw new SessionUnavailableError();
  }
  return token;
}

export function getSessionIdHash() {
  return hashSessionToken(getSessionToken());
}
