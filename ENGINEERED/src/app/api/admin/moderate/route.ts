import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/db";
import { isAdmin } from "@/lib/server/adminAuth";
import { jsonError, todayKey } from "@/lib/server/http";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("hide"), entryId: z.string(), hidden: z.boolean() }),
  z.object({ op: z.literal("clearDay"), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ op: z.literal("purgeStale") }),
]);

/**
 * Leaderboard/session moderation:
 *  - hide/unhide an entry (e.g. inappropriate name)
 *  - clear an entire day's leaderboard (authorized reset)
 *  - purge stale active sessions (older than 2 hours)
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) return jsonError(401, "Unauthorized");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid operation");

  const data = parsed.data;
  if (data.op === "hide") {
    await prisma.leaderboardEntry.update({ where: { id: data.entryId }, data: { hidden: data.hidden } });
    return NextResponse.json({ ok: true });
  }
  if (data.op === "clearDay") {
    await prisma.leaderboardEntry.deleteMany({ where: { day: data.day } });
    return NextResponse.json({ ok: true, day: data.day });
  }
  // purgeStale
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stale = await prisma.session.deleteMany({
    where: { status: "active", createdAt: { lt: cutoff } },
  });
  return NextResponse.json({ ok: true, purged: stale.count, today: todayKey() });
}
