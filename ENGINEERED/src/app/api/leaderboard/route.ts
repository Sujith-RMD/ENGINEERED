import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/db";
import { todayKey } from "@/lib/server/http";

/**
 * GET /api/leaderboard?scope=today|mission|all&missionId=...&limit=50
 * Daily boards reset on the UTC calendar day of the server.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "today";
  const missionId = url.searchParams.get("missionId");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const baseWhere = { hidden: false } as const;
  try {
    if (scope === "mission") {
      if (!missionId) return NextResponse.json({ error: "missionId required" }, { status: 400 });
      const entries = await prisma.leaderboardEntry.findMany({
        where: { ...baseWhere, missionId },
        orderBy: { score: "desc" },
        take: limit,
        include: { result: { select: { archetypeId: true, createdAt: true } } },
      });
      return NextResponse.json({ scope, entries });
    }

    if (scope === "all") {
      const entries = await prisma.leaderboardEntry.findMany({
        where: baseWhere,
        orderBy: { score: "desc" },
        take: limit,
        include: { result: { select: { archetypeId: true, createdAt: true } } },
      });
      return NextResponse.json({ scope, entries });
    }

    // scope === "today"
    const entries = await prisma.leaderboardEntry.findMany({
      where: { ...baseWhere, day: todayKey() },
      orderBy: { score: "desc" },
      take: limit,
      include: { result: { select: { archetypeId: true, createdAt: true } } },
    });
    return NextResponse.json({ scope: "today", day: todayKey(), entries });
  } catch {
    return NextResponse.json({ error: "Leaderboard unavailable", entries: [] }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
