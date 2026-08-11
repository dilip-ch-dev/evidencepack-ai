import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_TOKEN_PATTERN } from "@/lib/session-constants";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function createSessionToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

export function middleware(request: NextRequest) {
  const current = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (current && SESSION_TOKEN_PATTERN.test(current)) {
    return NextResponse.next();
  }

  const token = createSessionToken();
  const requestHeaders = new Headers(request.headers);
  const existingCookie = requestHeaders.get("cookie");
  requestHeaders.set(
    "cookie",
    existingCookie ? `${existingCookie}; ${SESSION_COOKIE_NAME}=${token}` : `${SESSION_COOKIE_NAME}=${token}`
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/"
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
