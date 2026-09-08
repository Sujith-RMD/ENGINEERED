import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/database/db";
import { getMission } from "@/data/missions";
import { jsonError, todayKey } from "@/lib/server/http";
import { clientKey, rateLimit } from "@/lib/server/rateLimit";
import { replayRun } from "@/lib/server/replay";
import { generateShareId, sanitizeName } from "@/lib/validation/name";
import { DIFFICULTIES } from "@/types/game";

const MAX_DECISIONS = 18;

const submissionSchema = z.object({
  sessionId: z.string().min(10).max(64),
  playerName: z.string().max(48).optional(),
  actions: z
    .array(
      z.object({
        actionId: z.string().min(1).max(64),
        t: z.number().finite().min(0).max(150),
        eventId: z.string().max(64).optional(),
      })
    )
    .max(MAX_DECISIONS),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "result"), 12, 60_000);
  if (!limit.ok) return jsonError(429, "Too many submissions");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body");
  }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid submission");

  const { sessionId, playerName, actions } = parsed.data;
  const name = sanitizeName(playerName);

  let session;
  try {
    session = await prisma.session.findUnique({ where: { id: sessionId } });
  } catch {
    return jsonError(503, "Database unavailable");
  }
  if (!session) return jsonError(404, "Session not found");
  if (session.status === "finished") return jsonError(409, "Session already submitted");
  if (Date.now() - session.createdAt.getTime() > 2 * 60 * 60 * 1000) {
    return jsonError(410, "Session expired");
  }
  if (!DIFFICULTIES.includes(session.difficulty as never)) {
    return jsonError(400, "Invalid session difficulty");
  }
  // Anti-cheat: every submitted action id must exist in the mission catalog.
  const mission = getMission(session.missionId);
  if (!mission) return jsonError(400, "Unknown mission");
  const validActionIds = new Set(mission.actions.map((a) => a.id));
  const unknown = actions.find((a) => !validActionIds.has(a.actionId));
  if (unknown) return jsonError(400, `Unknown action "${unknown.actionId}"`);

  // --- Authoritative re-simulation (never trust the client's score)
  const replay = replayRun(session.missionId, session.difficulty as never, session.rngSeed, actions);
  if (!replay.ok) return jsonError(400, replay.error);
  const result = replay.result;

  const day = todayKey();

  // Rank among today's (non-hidden) entries, before inserting this one.
  const [todayBetter, missionBetter] = await Promise.all([
    prisma.leaderboardEntry.count({ where: { day, hidden: false, score: { gt: result.score.overall } } }),
    prisma.leaderboardEntry.count({
      where: { day, hidden: false, missionId: session.missionId, score: { gt: result.score.overall } },
    }),
  ]);

  try {
    const created = await prisma.$transaction(async (tx) => {
      let shareId = generateShareId();
      // Rare collision: retry a couple of times.
      for (let attempt = 0; attempt < 3; attempt++) {
        const clash = await tx.result.findUnique({ where: { shareId } });
        if (!clash) break;
        shareId = generateShareId();
      }
      const row = await tx.result.create({
        data: {
          sessionId: session.id,
          missionId: session.missionId,
          difficulty: session.difficulty,
          playerName: name,
          score: result.score.overall,
          archetypeId: result.archetype.id,
          metrics: result.score as unknown as object,
          finalState: result.finalState as unknown as object,
          projection: { deltas: result.projection.deltas, storyBeats: result.projection.storyBeats } as unknown as object,
          summary: { achievement: result.achievement, mistake: result.mistake, outcome: result.score.outcome } as unknown as object,
          shareId,
        },
      });
      await tx.leaderboardEntry.create({
        data: {
          resultId: row.id,
          missionId: session.missionId,
          difficulty: session.difficulty,
          playerName: name,
          score: result.score.overall,
          day,
        },
      });
      await tx.session.update({ where: { id: session.id }, data: { status: "finished", finishedAt: new Date() } });
      return row;
    });

    return NextResponse.json({
      shareId: created.shareId,
      score: result.score.overall,
      outcome: result.score.outcome,
      skills: result.score.skills,
      archetype: result.archetype,
      projection: result.projection,
      achievement: result.achievement,
      mistake: result.mistake,
      finalState: result.finalState,
      missionId: session.missionId,
      difficulty: session.difficulty,
      rank: { today: todayBetter + 1, mission: missionBetter + 1 },
      ranked: true,
    });
  } catch {
    return jsonError(503, "Could not save result");
  }
}

export const dynamic = "force-dynamic";
