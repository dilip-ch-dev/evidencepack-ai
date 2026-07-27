import { NextResponse } from "next/server";

export type ApiAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey?.trim()) {
    return headerKey.trim();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Protect write APIs when EVIDENCEPACK_API_KEY is configured.
 * If unset, writes are open (local/demo convenience) — set the key on Vercel.
 */
export function requireApiKey(request: Request): ApiAuthResult {
  const expected = process.env.EVIDENCEPACK_API_KEY?.trim();
  if (!expected) {
    return { ok: true };
  }

  const provided = extractApiKey(request);
  if (!provided || provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Unauthorized",
          message: "Provide a valid API key via Authorization: Bearer <key> or x-api-key."
        },
        { status: 401 }
      )
    };
  }

  return { ok: true };
}

export function requireDemoResetKey(request: Request): ApiAuthResult {
  const expected = process.env.DEMO_RESET_KEY?.trim();
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Demo reset disabled",
          message: "Set DEMO_RESET_KEY to enable demo workspace reset."
        },
        { status: 403 }
      )
    };
  }

  const provided = extractApiKey(request);
  if (!provided || provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", message: "Invalid demo reset key." },
        { status: 401 }
      )
    };
  }

  return { ok: true };
}
