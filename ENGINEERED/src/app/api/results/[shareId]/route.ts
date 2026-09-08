import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/db";
import { ALL_MISSIONS } from "@/data/missions";

export async function GET(_request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  try {
    const result = await prisma.result.findUnique({
      where: { shareId },
      select: {
        shareId: true,
        missionId: true,
        difficulty: true,
        playerName: true,
        score: true,
        archetypeId: true,
        metrics: true,
        finalState: true,
        projection: true,
        summary: true,
        createdAt: true,
      },
    });
    if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });
    const mission = ALL_MISSIONS.find((m) => m.id === result.missionId);
    return NextResponse.json({
      ...result,
      missionTitle: mission?.title ?? result.missionId,
      missionIcon: mission?.icon ?? "🏗️",
    });
  } catch {
    return NextResponse.json({ error: "Result unavailable" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
