import type { Effect, MissionDef, ProjectionResult, ProjectionSnapshot, RunState, VariableId } from "@/types/game";
import { VARIABLES } from "./variables";
import { RELATIONSHIPS } from "./relationships";

/** Per-year decay of the mission's baseline drift (interventions dominate). */
const DRIFT_DECAY = 0.82;
/** Strength of the relationship pass per projection year. */
const YEAR_RELATIONSHIP_FACTOR = 0.22;
/** Light mean-reversion pulling extreme values back toward sanity. */
const EXTREME_REVERSION = 2.5;
const EXTREME_HIGH = 88;
const EXTREME_LOW = 12;

export interface ProjectionInput {
  mission: MissionDef;
  state: RunState;
  /** Delayed effects scheduled to land during the projection. */
  yearEffects: { note: string; atYear: number; effects: Effect[] }[];
}

/**
 * Deterministic 10-year projection. No RNG: the future is a pure function
 * of the decisions already made. Per year:
 *  1. delayed effects scheduled for that year land,
 *  2. the mission's baseline drift applies, decaying over time,
 *  3. one damped relationship pass propagates consequences,
 *  4. extremes revert slightly (systems self-correct at the margins).
 */
export function projectDecade({ mission, state, yearEffects }: ProjectionInput): ProjectionResult {
  const clamp = (metric: VariableId, value: number) => {
    const def = VARIABLES[metric];
    if (!def) return value;
    return Math.min(def.max, Math.max(def.min, Number.isFinite(value) ? value : def.min));
  };

  const metrics = {} as Record<VariableId, number>;
  for (const v of Object.keys(state.metrics) as VariableId[]) {
    metrics[v] = state.metrics[v] ?? 0;
  }

  const snapshots: ProjectionSnapshot[] = [{ year: 0, metrics: { ...metrics } }];
  const storyBeats: string[] = [];

  for (let year = 1; year <= 10; year++) {
    // 1. Delayed payoffs land
    const landing = yearEffects.filter((e) => e.atYear === year);
    for (const effect of landing) {
      for (const e of effect.effects) {
        metrics[e.metric] = clamp(e.metric, (metrics[e.metric] ?? 0) + e.delta);
      }
      if (year % 2 === 1 || year <= 3) {
        const parts = effect.effects
          .filter((e) => VARIABLES[e.metric] && mission.variables.includes(e.metric))
          .map((e) => `${VARIABLES[e.metric].label} ${e.delta > 0 ? "+" : ""}${Math.round(e.delta * 10) / 10}`);
        if (parts.length > 0) storyBeats.push(`Year ${year}: ${effect.note} — ${parts.join(", ")}.`);
      }
    }

    // 2. Baseline drift, decaying
    for (const [key, rateRaw] of Object.entries(mission.projectionDrift)) {
      const metric = key as VariableId;
      const rate = (rateRaw ?? 0) * Math.pow(DRIFT_DECAY, year - 1);
      metrics[metric] = clamp(metric, (metrics[metric] ?? 0) + rate);
    }

    // 3. Damped relationship pass
    const changes: Effect[] = [];
    for (const rel of RELATIONSHIPS) {
      if (metrics[rel.from] === undefined || metrics[rel.to] === undefined) continue;
      const deviation = (metrics[rel.from] - 50) / 50; // how far from balanced
      const delta = deviation * rel.factor * YEAR_RELATIONSHIP_FACTOR * 10;
      if (Math.abs(delta) >= 0.15) changes.push({ metric: rel.to, delta });
    }
    const merged = new Map<VariableId, number>();
    for (const c of changes) merged.set(c.metric, (merged.get(c.metric) ?? 0) + c.delta);
    for (const [metric, delta] of merged) {
      metrics[metric] = clamp(metric, (metrics[metric] ?? 0) + delta);
    }

    // 4. Extreme reversion
    for (const v of Object.keys(metrics) as VariableId[]) {
      if (metrics[v] > EXTREME_HIGH) metrics[v] = clamp(v, metrics[v] - EXTREME_REVERSION);
      else if (metrics[v] < EXTREME_LOW) metrics[v] = clamp(v, metrics[v] + EXTREME_REVERSION);
    }

    snapshots.push({ year, metrics: { ...metrics } });
  }

  // Deltas vs. the crisis baseline the engineer inherited
  const deltas = mission.variables
    .filter((v) => v !== "budget" && v !== "approval" && VARIABLES[v])
    .map((v) => {
      const start = mission.startState[v] ?? 50;
      const final = metrics[v] ?? start;
      const change = start === 0 ? 0 : ((final - start) / start) * 100;
      return {
        metric: v,
        label: VARIABLES[v].label,
        icon: VARIABLES[v].icon,
        change: Math.round(change * 10) / 10,
        higherIsBetter: VARIABLES[v].higherIsBetter,
      };
    });

  // Headline story beats: biggest movers
  const sorted = [...deltas].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  for (const d of sorted.slice(0, 3)) {
    const dir = d.change > 0 ? "rose" : "fell";
    storyBeats.push(`By year 10, ${d.label.toLowerCase()} ${dir} ${Math.abs(d.change).toFixed(0)}% versus the crisis baseline.`);
  }

  return {
    snapshots,
    finalMetrics: metrics as unknown as Record<string, number>,
    deltas,
    storyBeats: storyBeats.slice(0, 6),
  };
}
