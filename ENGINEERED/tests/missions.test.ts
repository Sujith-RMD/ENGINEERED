import { describe, it, expect } from "vitest";
import { ALL_MISSIONS, MISSION_IDS } from "@/data/missions";
import { validateMission, validateRegistry } from "@/lib/missions/validate";

describe("mission registry", () => {
  it("ships exactly 10 missions with unique ids", () => {
    expect(ALL_MISSIONS).toHaveLength(10);
    expect(new Set(MISSION_IDS).size).toBe(10);
  });

  it("passes structural validation with zero errors", () => {
    const issues = validateRegistry(ALL_MISSIONS);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors, errors.map((e) => `${e.missionId}: ${e.path} — ${e.message}`).join("\n")).toHaveLength(0);
  });

  it("each mission has a unique strategic identity", () => {
    for (const m of ALL_MISSIONS) {
      // headline variables distinct from budget/approval
      const headline = m.variables.filter((v) => v !== "budget" && v !== "approval");
      expect(headline.length, m.id).toBeGreaterThanOrEqual(4);
      // at least one synergy pair somewhere in the catalog
      const synergies = m.actions.filter((a) => a.synergy).length;
      expect(synergies, `${m.id} needs a synergy pair`).toBeGreaterThanOrEqual(1);
      // trap-free trade-offs: no all-positive action with no cost
      for (const a of m.actions) {
        const cost = (a.cost.budget ?? 0) + (a.cost.approval ?? 0);
        const hasDownside =
          (a.risks?.length ?? 0) > 0 ||
          (a.delayed ?? []).some((d) =>
            d.effects.some((e) => (e.metric === "budget" ? false : e.delta < 0))
          ) ||
          (a.immediate ?? []).some((e) => e.delta < 0) ||
          (a.conflictsWith?.length ?? 0) > 0;
        if (a.scope === "standard" && cost === 0) {
          expect(hasDownside, `${m.id}/${a.id} is free with no downside`).toBe(true);
        }
      }
    }
  });

  it("every mission has at least one major event inside the 30–150s band", () => {
    for (const m of ALL_MISSIONS) {
      const majors = m.events.filter((e) => e.kind === "major");
      expect(majors.length, m.id).toBeGreaterThanOrEqual(1);
      for (const e of majors) {
        expect(e.window!.start).toBeGreaterThanOrEqual(30);
        expect(e.window!.end).toBeLessThanOrEqual(150);
      }
    }
  });

  it("scoring weights always favor a mix, never one metric", () => {
    for (const m of ALL_MISSIONS) {
      const weights = Object.values(m.scoringWeights);
      const max = Math.max(...weights);
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(max / sum, `${m.id}: one metric dominates`).toBeLessThan(0.4);
    }
  });
});
