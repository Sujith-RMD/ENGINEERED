import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "eng_admin";

function passcode(): string {
  return process.env.ADMIN_PASSCODE ?? "CHANGE-ME";
}

function tokenFor(passcodeValue: string): string {
  return createHash("sha256").update(`engineered::${passcodeValue}`).digest("hex");
}

/** Constant-time-ish comparison (short inputs, fine for a stall event). */
function matches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyPasscode(input: string): boolean {
  return matches(tokenFor(input), tokenFor(passcode()));
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;
  return matches(value, tokenFor(passcode()));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24, // one event day
  };
}

export { COOKIE_NAME };
