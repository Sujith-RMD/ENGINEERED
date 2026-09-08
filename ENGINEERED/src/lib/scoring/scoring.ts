import type {
  DecisionRecord,
  Difficulty,
  LogEntry,
  MissionDef,
  ProjectionResult,
  RunState,
  ScoreResult,
  SkillScores,
  VariableId,
} from "@/types/game";
import { DIFFICULTY_TUNING } from "@/lib/simulation/engine";
import { VARIABLES } from "@/lib/simulation/variables";

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function normalize(mission: MissionDef, metric: VariableId, value: number | undefined): number {
  const def = VARIABLES[metric];
  const v = value ?? 50;
  if (!def || def.higherIsBetter) return v;
  return 100 - v;
}

/** Weighted mission outcome (0–100) from the projected 10-year state. */
export function computeOutcome(mission: MissionDef, projection: ProjectionResult): number {
  let total = 0;
  let weightSum = 0;
  for (const v of mission.variables) {
    if (v === "budget" || v === "approval") continue;
    const w = mission.scoringWeights[v] ?? 0;
    if (w <= 0) continue;
    const norm = normalize(mission, v, projection.finalMetrics[v]);
    total += norm * w;
    weightSum += w;
  }
  if (weightSum === 0) return 50;
  return clampScore(total / weightSum);
}

export interface BehaviorContext {
  mission: MissionDef;
  state: RunState;
  decisions: DecisionRecord[];
  projection: ProjectionResult;
  difficulty: Difficulty;
}

function netEffectOfDecision(decision: DecisionRecord): number {
  let net = 0;
  for (const [metric, after] of Object.entries(decision.stateAfter)) {
    const def = VARIABLES[metric as VariableId];
    if (!def || metric === "budget" || metric === "approval") continue;
    const before = decision.stateBefore[metric] ?? after;
    const delta = after - before;
    net += def.higherIsBetter ? delta : -delta;
  }
  return net;
}

/**
 * The eight skill categories. Everything derives from behavior actually
 * observed in the decision log — never from a single metric.
 */
export function computeSkills(ctx: BehaviorContext): SkillScores {
  const { mission, state, decisions, projection, difficulty } = ctx;
  const headline = mission.variables.filter((v) => v !== "budget" && v !== "approval");
  const actionsById = new Map(mission.actions.map((a) => [a.id, a]));
  const takenDefs = decisions.map((d) => actionsById.get(d.actionId)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const tagsUsed = new Set(takenDefs.flatMap((a) => a.tags));
  const spent = decisions.reduce((sum, d) => sum + (d.cost.budget ?? 0), 0);
  const budgetLeft = state.metrics.budget ?? 0;
  const outcome = computeOutcome(mission, projection);

  // --- Systems thinking: breadth + balance of improvement
  const improvements = headline.map((v) => {
    const start = mission.startState[v] ?? 50;
    const final = projection.finalMetrics[v] ?? start;
    const def = VARIABLES[v];
    const raw = final - start;
    return def.higherIsBetter ? raw : -raw;
  });
  const improvedCount = improvements.filter((i) => i > 1).length;
  const mean = improvements.reduce((a, b) => a + b, 0) / Math.max(1, improvements.length);
  const variance = improvements.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, improvements.length);
  const stdev = Math.sqrt(variance);
  const balance = Math.max(0, 1 - stdev / 18);
  const systemsThinking = clampScore((improvedCount / Math.max(1, headline.length)) * 65 + balance * 35);

  // --- Innovation: unconventional tech + synergies + long-payoff bets
  const innovationActions = takenDefs.filter((a) => a.tags.includes("innovation")).length;
  const synergies = takenDefs.filter((a) => a.synergy && state.taken.some((t) => t.actionId === a.synergy!.withActionId)).length;
  const longBets = takenDefs.filter((a) => (a.delayed ?? []).some((d) => d.atYear !== undefined)).length;
  const innovation = clampScore(innovationActions * 22 + synergies * 16 + longBets * 10);

  // --- Resource efficiency: outcome delivered per crore, plus thrift
  const efficiencyCurve = 0.55 + 0.45 * Math.min(1, 30 / Math.max(30, spent));
  const resourceEfficiency = clampScore(outcome * efficiencyCurve + Math.min(15, budgetLeft / 4));

  // --- Sustainability: ecological trajectory
  const sustainFinal = normalize(mission, "sustainability", projection.finalMetrics.sustainability);
  const pollutionFinal = normalize(mission, "pollution", projection.finalMetrics.pollution);
  const greenTags = takenDefs.filter((a) => a.tags.includes("green")).length;
  const sustainability = clampScore(
    (sustainFinal * 0.4 + pollutionFinal * 0.4) + Math.min(20, greenTags * 8)
  );

  // --- Social impact: people, not pipes
  const satisfaction = normalize(mission, "citizenSatisfaction", projection.finalMetrics.citizenSatisfaction);
  const health = normalize(mission, "publicHealth", projection.finalMetrics.publicHealth);
  const approvalKept = state.metrics.approval ?? 50;
  const socialEngineerActions = takenDefs.filter((a) => a.tags.includes("political")).length;
  const socialImpact = clampScore(
    satisfaction * 0.55 + health * 0.25 + (approvalKept / 100) * 20 + Math.min(10, socialEngineerActions * 4)
  );

  // --- Resilience: built capacity + shock absorption actually demonstrated
  const resilienceFinal = normalize(mission, "resilience", projection.finalMetrics.resilience);
  const readinessFinal = normalize(mission, "emergencyReadiness", projection.finalMetrics.emergencyReadiness);
  const firedEvents = state.firedEvents.length;
  const absorbedAvg = eventAbsorption(state, mission);
  const resilience = clampScore(
    resilienceFinal * 0.45 + readinessFinal * 0.25 + absorbedAvg * 100 * 0.3 + (firedEvents === 0 ? 5 : 0)
  );

  // --- Crisis response: containment under fire
  let crisisResponse = 65; // neutral when no crises fire
  if (firedEvents > 0) {
    let sum = 0;
    let weight = 0;
    for (const eventId of state.firedEvents) {
      const ev = mission.events.find((e) => e.id === eventId);
      if (!ev) continue;
      const w = ev.kind === "major" ? 1 : 0.5;
      const responded = decisions.some((d) => d.eventId === eventId);
      const quickBonus = responded ? (ev.kind === "major" ? 15 : 7) : 0;
      sum += (responded ? 85 : 20) + quickBonus;
      weight += w;
    }
    crisisResponse = clampScore(weight > 0 ? sum / (weight > 0 ? state.firedEvents.length : 1) : 65);
  }

  // --- Long-term planning: did the engineer plant trees?
  const delayedActions = takenDefs.filter((a) => (a.delayed ?? []).length > 0).length;
  const delayedRate = delayedActions / Math.max(1, takenDefs.length);
  const infraInvest = takenDefs.filter((a) => a.tags.includes("resilience") || a.tags.includes("transit") || a.tags.includes("energy")).length;
  const longTermPlanning = clampScore(
    delayedRate * 55 + Math.min(25, infraInvest * 7) + (outcome >= 60 ? 20 : outcome >= 45 ? 10 : 0)
  );

  void difficulty; // applied at overall level
  void tagsUsed;
  return {
    systemsThinking,
    innovation,
    resourceEfficiency,
    sustainability,
    socialImpact,
    resilience,
    crisisResponse,
    longTermPlanning,
  };
}

/** Average fraction of event damage avoided via preparedness (0..1). */
function eventAbsorption(state: RunState, mission: MissionDef): number {
  if (state.firedEvents.length === 0) return 0.5;
  let sum = 0;
  for (const eventId of state.firedEvents) {
    const ev = mission.events.find((e) => e.id === eventId);
    if (!ev?.mitigation) {
      sum += 0.5;
      continue;
    }
    const value = state.metrics[ev.mitigation.metric] ?? 0;
    sum += Math.min(0.6, value / 150);
  }
  return sum / state.firedEvents.length;
}

export function computeOverall(outcome: number, skills: SkillScores, difficulty: Difficulty): number {
  const skillMean =
    (skills.systemsThinking +
      skills.innovation +
      skills.resourceEfficiency +
      skills.sustainability +
      skills.socialImpact +
      skills.resilience +
      skills.crisisResponse +
      skills.longTermPlanning) /
    8;
  const modifier = DIFFICULTY_TUNING[difficulty].scoreModifier;
  return clampScore((outcome * 0.55 + skillMean * 0.35 + skills.crisisResponse * 0.1) * modifier);
}

export function scoreRun(
  mission: MissionDef,
  state: RunState,
  decisions: DecisionRecord[],
  projection: ProjectionResult,
  difficulty: Difficulty
): ScoreResult {
  const outcome = computeOutcome(mission, projection);
  const skills = computeSkills({ mission, state, decisions, projection, difficulty });
  const overall = computeOverall(outcome, skills, difficulty);
  return { overall, outcome, skills, difficultyModifier: DIFFICULTY_TUNING[difficulty].scoreModifier };
}

/** Feed entries referring to decisions (used for narrative highlights). */
export function decisionsFromLog(log: LogEntry[]): LogEntry[] {
  return log.filter((l) => l.kind === "action" || l.kind === "response");
}
