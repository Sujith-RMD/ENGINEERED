import { NextResponse } from "next/server";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** UTC calendar day key used for daily leaderboards. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
