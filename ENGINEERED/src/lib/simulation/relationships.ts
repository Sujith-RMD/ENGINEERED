import type { Effect, VariableId } from "@/types/game";
import { SECONDARY_MAX_WAVES, SECONDARY_PROPAGATION_FLOOR, SECONDARY_WAVE_DAMPING } from "./variables";

/**
 * The global relationship graph — the heart of systems thinking.
 * When `from` moves by Δ in one application, `to` drifts by Δ·factor in
 * the same pass (damped geometrically over waves, see applyEffects).
 *
 * Factors are per-unit and deliberately modest: a single decision should
 * bend the system, not teleport it. Magnitudes are tuned so a ±20 swing
 * on a source produces a ±3–6 swing on strongly coupled targets.
 */
export interface Relationship {
  from: VariableId;
  to: VariableId;
  factor: number;
  note?: string;
}

export const RELATIONSHIPS: Relationship[] = [
  // Congestion taxes everything downstream
  { from: "traffic", to: "economicEfficiency", factor: -0.28 },
  { from: "traffic", to: "citizenSatisfaction", factor: -0.2 },
  { from: "traffic", to: "pollution", factor: 0.22 },
  { from: "traffic", to: "emergencyReadiness", factor: -0.12, note: "slow response times" },

  // Public transport relieves congestion and pollution
  { from: "publicTransport", to: "traffic", factor: -0.3 },
  { from: "publicTransport", to: "pollution", factor: -0.15 },
  { from: "publicTransport", to: "citizenSatisfaction", factor: 0.12 },

  // Water is upstream of health and economy
  { from: "waterSecurity", to: "publicHealth", factor: 0.22 },
  { from: "waterSecurity", to: "economicEfficiency", factor: 0.18 },
  { from: "waterSecurity", to: "citizenSatisfaction", factor: 0.15 },

  // Energy is upstream of everything modern
  { from: "energyStability", to: "economicEfficiency", factor: 0.25 },
  { from: "energyStability", to: "publicHealth", factor: 0.12 },
  { from: "energyStability", to: "citizenSatisfaction", factor: 0.12 },

  // Pollution poisons health and mood
  { from: "pollution", to: "publicHealth", factor: -0.3 },
  { from: "pollution", to: "citizenSatisfaction", factor: -0.18 },
  { from: "pollution", to: "sustainability", factor: -0.2 },

  // Sustainability is a slow, compounding ally
  { from: "sustainability", to: "publicHealth", factor: 0.15 },
  { from: "sustainability", to: "resilience", factor: 0.12 },
  { from: "sustainability", to: "pollution", factor: -0.18 },

  // Infrastructure enables economy and absorbs shocks
  { from: "infrastructure", to: "economicEfficiency", factor: 0.2 },
  { from: "infrastructure", to: "resilience", factor: 0.18 },
  { from: "infrastructure", to: "citizenSatisfaction", factor: 0.1 },

  // Resilience converts shocks into anecdotes
  { from: "resilience", to: "citizenSatisfaction", factor: 0.12 },
  { from: "resilience", to: "economicEfficiency", factor: 0.1 },

  // Health underwrites satisfaction and work
  { from: "publicHealth", to: "citizenSatisfaction", factor: 0.18 },
  { from: "publicHealth", to: "economicEfficiency", factor: 0.15 },

  // Economy funds goodwill (and the perception of competence)
  { from: "economicEfficiency", to: "citizenSatisfaction", factor: 0.15 },

  // Innovation compounds into efficiency
  { from: "innovation", to: "economicEfficiency", factor: 0.15 },

  // Emergency readiness is insurance paid in calm moments
  { from: "emergencyReadiness", to: "publicHealth", factor: 0.12 },
  { from: "emergencyReadiness", to: "citizenSatisfaction", factor: 0.1 },

  // Waste capacity keeps cities livable
  { from: "wasteCapacity", to: "publicHealth", factor: 0.2 },
  { from: "wasteCapacity", to: "pollution", factor: -0.22 },

  // Fire spread is destructive across the board
  { from: "fireSpread", to: "infrastructure", factor: -0.25 },
  { from: "fireSpread", to: "publicHealth", factor: -0.22 },
  { from: "fireSpread", to: "citizenSatisfaction", factor: -0.2 },

  // Oxygen is life: no margin, no morale, no colony
  { from: "oxygen", to: "citizenSatisfaction", factor: 0.25 },
  { from: "oxygen", to: "publicHealth", factor: 0.3 },
];

const RELATIONSHIP_INDEX: Record<string, Relationship[]> = (() => {
  const index: Record<string, Relationship[]> = {};
  for (const rel of RELATIONSHIPS) {
    (index[rel.from] ??= []).push(rel);
  }
  return index;
})();

export function relationshipsFrom(variable: VariableId): Relationship[] {
  return RELATIONSHIP_INDEX[variable] ?? [];
}

/**
 * Apply direct effects, then propagate secondary consequences in damped
 * waves. Returns the applied deltas grouped by wave (for the feed).
 *
 * Wave 1: the direct effects themselves.
 * Wave 2: relationships of wave-1 changes, scaled by DAMPING.
 * Wave 3: relationships of wave-2 changes, scaled by DAMPING².
 *
 * Propagation stops when every remaining delta is below the floor, so
 * cascades are always finite (and never runaway).
 */
export function applyEffects(
  metrics: Record<VariableId, number>,
  direct: Effect[],
  clampFn: (metric: VariableId, value: number) => number
): { metrics: Record<VariableId, number>; waves: Effect[][] } {
  const next = { ...metrics };
  const waves: Effect[][] = [];

  const mergeWave = (changes: Effect[]): Effect[] => {
    const merged = new Map<VariableId, number>();
    for (const c of changes) {
      merged.set(c.metric, (merged.get(c.metric) ?? 0) + c.delta);
    }
    return [...merged.entries()].map(([metric, delta]) => ({ metric, delta }));
  };

  // Wave 1 — direct
  const wave1 = mergeWave(direct);
  for (const { metric, delta } of wave1) {
    next[metric] = clampFn(metric, (next[metric] ?? 0) + delta);
  }
  waves.push(wave1.filter((w) => Math.abs(w.delta) >= 0.05));

  // Waves 2..N — relationships of the previous wave
  let previous = wave1;
  let damping = SECONDARY_WAVE_DAMPING;
  for (let wave = 2; wave <= SECONDARY_MAX_WAVES; wave++) {
    const outgoing: Effect[] = [];
    for (const { metric, delta } of previous) {
      for (const rel of relationshipsFrom(metric)) {
        if (next[rel.to] === undefined) continue; // only propagate within tracked metrics
        const targetDelta = delta * rel.factor * damping;
        if (Math.abs(targetDelta) < SECONDARY_PROPAGATION_FLOOR) continue;
        outgoing.push({ metric: rel.to, delta: targetDelta });
      }
    }
    if (outgoing.length === 0) break;
    const merged = mergeWave(outgoing);
    const applied: Effect[] = [];
    for (const { metric, delta } of merged) {
      const before = next[metric] ?? 0;
      next[metric] = clampFn(metric, before + delta);
      const actual = next[metric] - before;
      if (Math.abs(actual) >= 0.05) applied.push({ metric, delta: actual });
    }
    if (applied.length === 0) break;
    waves.push(applied);
    previous = applied;
    damping *= SECONDARY_WAVE_DAMPING;
  }

  return { metrics: next, waves: waves.filter((w) => w.length > 0) };
}

/** Human sentence for a wave of deltas, e.g. "Economic Efficiency −2.1, Pollution +1.4". */
export function describeWaves(waves: Effect[][], labelFn: (m: VariableId) => string): string[] {
  const lines: string[] = [];
  waves.forEach((wave, i) => {
    if (i === 0) return; // wave 0 is the action itself; caller narrates it
    const parts = wave
      .filter((e) => Math.abs(e.delta) >= 0.4)
      .map((e) => `${labelFn(e.metric)} ${e.delta > 0 ? "+" : ""}${e.delta.toFixed(1)}`);
    if (parts.length > 0) lines.push(`Ripple ${i}: ${parts.join(", ")}`);
  });
  return lines;
}
