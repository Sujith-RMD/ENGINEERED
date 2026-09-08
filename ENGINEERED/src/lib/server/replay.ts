import { getMission } from "@/data/missions";
import { RunEngine } from "@/lib/simulation/engine";
import { projectDecade } from "@/lib/simulation/projection";
import { scoreRun } from "@/lib/scoring/scoring";
import { ARCHETYPES, assignArchetype, collectSignals } from "@/lib/scoring/archetypes";
import { pickAchievement, pickMistake } from "@/lib/scoring/insights";
import type { Difficulty, RunResult } from "@/types/game";

export interface ReplayAction {
  actionId: string;
  t: number;
  eventId?: string;
}

/**
 * THE SECURITY CORE: a submitted run is never trusted. The server
 * re-simulates the entire run from the (mission, seed, decision list) —
 * the engine is deterministic, so the replay reproduces exactly what the
 * player saw, while enforcing every rule (budgets, cooldowns, conflicts,
 * event windows). Client-computed scores are ignored.
 */
export function replayRun(
  missionId: string,
  difficulty: Difficulty,
  seed: number,
  actions: ReplayAction[]
): { ok: true; result: RunResult } | { ok: false; error: string } {
  const mission = getMission(missionId);
  if (!mission) return { ok: false, error: `Unknown mission "${missionId}"` };

  const engine = new RunEngine(mission, seed, { difficulty });
  const ordered = [...actions].sort((a, b) => a.t - b.t);
  for (const action of ordered) {
    if (engine.state.status !== "running") break;
    const t = Math.max(0, Math.min(149, Math.floor(action.t)));
    engine.processUntil(t);
    const active = engine.state.activeEvent;
    if (active && action.eventId === active.eventId) {
      const event = mission.events.find((e) => e.id === active.eventId);
      if (event?.responses.includes(action.actionId)) {
        engine.respondToEvent(action.actionId);
        continue;
      }
    }
    engine.takeAction(action.actionId); // invalid decisions are rejected silently by the engine
  }
  engine.processUntil(150);
  engine.endRun();

  const projection = projectDecade({
    mission,
    state: engine.state,
    yearEffects: engine.getProjectionEffects(),
  });
  const score = scoreRun(mission, engine.state, engine.decisions, projection, difficulty);
  const signals = collectSignals(mission, engine.state, engine.decisions, score.skills);
  const archetype = ARCHETYPES[assignArchetype(signals)];
  const achievement = pickAchievement(mission, projection);
  const mistake = pickMistake(mission, engine.state, projection, engine.decisions);

  return {
    ok: true,
    result: {
      missionId,
      difficulty,
      score,
      archetype,
      projection,
      finalState: { ...engine.state.metrics },
      achievement,
      mistake,
      decisions: engine.decisions,
      log: engine.state.log,
    },
  };
}
