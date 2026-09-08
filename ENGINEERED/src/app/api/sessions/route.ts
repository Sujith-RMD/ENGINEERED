import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/db";
import { getMission } from "@/data/missions";
import { getEnabledMissionIds } from "@/lib/server/settings";
import { jsonError } from "@/lib/server/http";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { DIFFICULTIES } from "@/types/game";

const createSchema = z.object({
  missionId: z.string().min(1).max(64),
  difficulty: z.enum(["easy", "normal", "hard", "nightmare"]).default("normal"),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "session"), 30, 60_000);
  if (!limit.ok) return jsonError(429, "Too many requests. Take a breath, engineer.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid request body");

  const { missionId, difficulty } = parsed.data;
  if (!getMission(missionId)) return jsonError(404, "Mission not found");
  const enabled = await getEnabledMissionIds();
  if (!enabled.includes(missionId)) return jsonError(403, "Mission is currently disabled");

  const seed = Math.floor(Math.random() * 2 ** 31);
  try {
    const session = await prisma.session.create({
      data: { missionId, difficulty, rngSeed: seed },
    });
    return NextResponse.json({ sessionId: session.id, seed, missionId, difficulty });
  } catch {
    // Database unreachable: the run can still happen (offline mode);
    // the client will play locally and skip leaderboard submission.
    return jsonError(503, "Database unavailable", { offline: true });
  }
}

export async function GET() {
  const enabled = await getEnabledMissionIds();
  return NextResponse.json({ enabled });
}

export const dynamic = "force-dynamic";
