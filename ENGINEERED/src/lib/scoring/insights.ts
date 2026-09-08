import type { DecisionRecord, Insight, MissionDef, ProjectionResult, RunState, VariableId } from "@/types/game";
import { VARIABLES } from "@/lib/simulation/variables";

const normalize = (metric: VariableId, value: number | undefined) => {
  const def = VARIABLES[metric];
  const v = value ?? 50;
  if (!def || def.higherIsBetter) return v;
  return 100 - v;
};

/**
 * The biggest achievement: the mission-weighted metric with the best
 * final standing, phrased against the crisis baseline.
 */
export function pickAchievement(mission: MissionDef, projection: ProjectionResult): Insight {
  let best: { label: string; value: number; change: number } | null = null;
  for (const v of mission.variables) {
    if (v === "budget" || v === "approval") continue;
    const w = mission.scoringWeights[v] ?? 0;
    const norm = normalize(v, projection.finalMetrics[v]);
    const weighted = norm * w;
    const delta = projection.deltas.find((d) => d.metric === v);
    if (!best || weighted > best.value) {
      best = { label: VARIABLES[v].label, value: weighted, change: delta?.change ?? 0 };
    }
  }
  if (!best) {
    return { title: "STEWARDSHIP", text: "You held the system together under pressure." };
  }
  const dir = best.change >= 0 ? "improved" : "was protected at";
  const pct = Math.abs(best.change).toFixed(0);
  return {
    title: best.label,
    text:
      best.change >= 0
        ? `${best.label} ${dir} by ${pct}% over the decade — the strongest signal in your system.`
        : `Despite severe pressure, ${best.label.toLowerCase()} ${dir} a stable level — the strongest signal in your system.`,
  };
}

/**
 * The biggest mistake: the most damaging observable behavior. Priority:
 * ignored crisis > worst single decision > most-damaged weighted metric.
 */
export function pickMistake(
  mission: MissionDef,
  state: RunState,
  projection: ProjectionResult,
  decisions: DecisionRecord[]
): Insight {
  // 1. An ignored crisis response window
  const ignoredEvents = state.firedEvents.filter(
    (eventId) => !decisions.some((d) => d.eventId === eventId)
  );
  if (ignoredEvents.length > 0) {
    const ev = mission.events.find((e) => e.id === ignoredEvents[0]);
    if (ev) {
      return {
        title: `IGNORED: ${ev.title.toUpperCase()}`,
        text: `The ${ev.title} window expired without a response. Prepared mitigation would have cost less than the damage it left behind.`,
      };
    }
  }

  // 2. The single worst decision by net weighted effect
  const actionsById = new Map(mission.actions.map((a) => [a.id, a]));
  let worst: { title: string; net: number; text: string } | null = null;
  for (const d of decisions) {
    const a = actionsById.get(d.actionId);
    if (!a || d.eventId) continue;
    let net = 0;
    for (const [metric, after] of Object.entries(d.stateAfter)) {
      const def = VARIABLES[metric as VariableId];
      if (!def || metric === "budget" || metric === "approval") continue;
      const w = mission.scoringWeights[metric as VariableId] ?? 0;
      if (w <= 0) continue;
      const before = d.stateBefore[metric] ?? after;
      const delta = after - before;
      net += (def.higherIsBetter ? delta : -delta) * w;
    }
    if (!worst || net < worst.net) {
      worst = { title: a.title, net, text: a.title };
    }
  }
  if (worst && worst.net < -2) {
    return {
      title: `REGRET: ${worst.title.toUpperCase()}`,
      text: `${worst.title} cost the system more than it returned in your weighted mission priorities. The ripple outlived the benefit.`,
    };
  }

  // 3. The most-damaged weighted headline metric
  let damaged: { label: string; change: number } | null = null;
  for (const v of mission.variables) {
    if (v === "budget" || v === "approval") continue;
    if ((mission.scoringWeights[v] ?? 0) <= 0) continue;
    const delta = projection.deltas.find((d) => d.metric === v);
    const bad = VARIABLES[v].higherIsBetter ? (delta?.change ?? 0) < 0 : (delta?.change ?? 0) > 0;
    if (bad && (!damaged || Math.abs(delta!.change) > Math.abs(damaged.change))) {
      damaged = { label: VARIABLES[v].label, change: delta!.change };
    }
  }
  if (damaged) {
    return {
      title: `NEGLECT: ${damaged.label}`,
      text: `${damaged.label} moved ${Math.abs(damaged.change).toFixed(0)}% in the wrong direction across the decade — the cost of the priorities you chose elsewhere.`,
    };
  }

  return { title: "NO GLARING ERRORS", text: "No single decision stands out as a mistake. Your losses were structural, not tactical." };
}
