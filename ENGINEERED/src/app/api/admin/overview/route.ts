import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/db";
import { isAdmin } from "@/lib/server/adminAuth";
import { getEnabledMissionIds } from "@/lib/server/settings";
import { todayKey } from "@/lib/server/http";
import { ALL_MISSIONS } from "@/data/missions";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const day = todayKey();
  try {
    const [activeSessions, recentResults, todayEntries, enabled] = await Promise.all([
      prisma.session.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, missionId: true, difficulty: true, createdAt: true },
      }),
      prisma.result.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, shareId: true, missionId: true, difficulty: true, playerName: true, score: true, archetypeId: true, createdAt: true },
      }),
      prisma.leaderboardEntry.findMany({
        where: { day, hidden: false },
        orderBy: { score: "desc" },
        take: 10,
        select: { id: true, missionId: true, playerName: true, score: true, difficulty: true },
      }),
      getEnabledMissionIds(),
    ]);
    return NextResponse.json({
      day,
      activeSessions,
      recentResults,
      todayEntries,
      missions: ALL_MISSIONS.map((m) => ({
        id: m.id,
        title: m.title,
        icon: m.icon,
        difficulty: m.difficulty,
        enabled: enabled.includes(m.id),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
