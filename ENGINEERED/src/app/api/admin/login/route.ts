import { NextResponse } from "next/server";
import { z } from "zod";
import { adminCookieOptions, COOKIE_NAME, verifyPasscode } from "@/lib/server/adminAuth";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { jsonError } from "@/lib/server/http";

const loginSchema = z.object({ passcode: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "admin-login"), 10, 60_000);
  if (!limit.ok) return jsonError(429, "Too many attempts");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body");
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success || !verifyPasscode(parsed.data.passcode)) {
    return jsonError(401, "Invalid passcode");
  }

  const { createHash } = await import("node:crypto");
  const token = createHash("sha256").update(`engineered::${parsed.data.passcode}`).digest("hex");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, adminCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
