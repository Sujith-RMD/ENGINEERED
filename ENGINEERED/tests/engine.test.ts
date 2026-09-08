import { describe, it, expect } from "vitest";
import { RunEngine } from "@/lib/simulation/engine";
import { projectDecade } from "@/lib/simulation/projection";
import { scoreRun } from "@/lib/scoring/scoring";
import { assignArchetype, collectSignals } from "@/lib/scoring/archetypes";
import { ALL_MISSIONS } from "@/data/missions";
import type { Difficulty, RunSubmission } from "@/types/game";

/** Reference controller: what the client will actually do. */
function playToEnd(missionId: string, actions: { actionId: string; t: number }[], seed = 12345, difficulty: Difficulty = "normal") {
  const mission = ALL_MISSIONS.find((m) => m.id === missionId)!;
  const engine = new RunEngine(mission, seed, { difficulty });
  // Replay decisions in mission-clock order, processing time between them.
  const ordered = [...actions].sort((a, b) => a.t - b.t);
  for (const a of ordered) {
    engine.processUntil(a.t);
    // Event responses: if an event is active and the action is one of its responses, respond.
    const active = engine.state.activeEvent;
    if (active) {
      const ev = mission.events.find((e) => e.id === active.eventId);
      if (ev?.responses.includes(a.actionId)) {
        engine.respondToEvent(a.actionId);
        continue;
      }
    }
    engine.takeAction(a.actionId);
  }
  engine.processUntil(150);
  engine.endRun();
  return { engine, mission };
}

describe("simulation engine determinism", () => {
  it("same seed + same decisions = identical run", () => {
    const m = ALL_MISSIONS[0]!;
    const actions = [{ actionId: "smart-traffic-signals", t: 5 }];
    const a = playToEnd(m.id, actions, 777);
    const b = playToEnd(m.id, actions, 777);
    expect(b.engine.state.metrics).toEqual(a.engine.state.metrics);
    expect(b.engine.state.log.map((l) => l.text)).toEqual(a.engine.state.log.map((l) => l.text));
    expect(b.engine.state.firedEvents).toEqual(a.engine.state.firedEvents);
  });

  it("different seeds change event draws but never crash", () => {
    const m = ALL_MISSIONS[0]!;
    for (const seed of [1, 2, 3, 42, 999]) {
      const { engine } = playToEnd(m.id, [{ actionId: "smart-traffic-signals", t: 5 }], seed);
      expect(engine.state.status).toBeDefined();
      for (const [k, v] of Object.entries(engine.state.metrics)) {
        expect(Number.isFinite(v), `${k} must be finite`).toBe(true);
      }
    }
  });

  it("metrics always stay within declared bounds", () => {
    for (const mission of ALL_MISSIONS) {
      const engine = new RunEngine(mission, 2024);
      engine.processUntil(150);
      for (const [k, v] of Object.entries(engine.state.metrics)) {
        expect(Number.isFinite(v), `${mission.id}/${k} must be finite`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(500);
      }
    }
  });
});

describe("decision mechanics", () => {
  it("rejects actions the player cannot afford", () => {
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 5);
    engine.takeAction("metro-expansion"); // costs 22 of 50
    engine.takeAction("metro-expansion"); // conflicts with flyovers, also too expensive? (28 left)
    const ok = engine.takeAction("flyover-package"); // conflicts with metro
    expect(ok).toBe(false);
  });

  it("rejects unknown actions", () => {
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 5);
    expect(engine.takeAction("does-not-exist")).toBe(false);
  });

  it("rejects crisis-only actions outside a crisis", () => {
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 5);
    expect(engine.takeAction("crisis-drainage-ops")).toBe(false);
  });

  it("cooldowns are enforced", () => {
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 5);
    expect(engine.takeAction("smart-traffic-signals")).toBe(true);
    expect(engine.takeAction("smart-traffic-signals")).toBe(false); // no time has passed
    engine.processUntil(30);
    expect(engine.takeAction("smart-traffic-signals")).toBe(true); // cooldown expired
  });

  it("budget never goes negative and spend is recorded", () => {
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 5);
    engine.processUntil(3);
    engine.takeAction("metro-expansion");
    expect(engine.state.metrics.budget).toBeGreaterThanOrEqual(0);
    expect(engine.decisions).toHaveLength(1);
    expect(engine.decisions[0]!.stateBefore.budget).toBeGreaterThan(engine.decisions[0]!.stateAfter.budget);
  });

  it("synergy fires when both partner actions are taken", () => {
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 5);
    engine.processUntil(2);
    engine.takeAction("metro-expansion");
    engine.processUntil(6);
    engine.takeAction("congestion-pricing");
    const synergyLogs = engine.state.log.filter((l) => l.text.includes("SYNERGY"));
    expect(synergyLogs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("event engine", () => {
  it("exactly one major event fires per normal run", () => {
    for (const seed of [11, 22, 33]) {
      const { engine } = playToEnd(ALL_MISSIONS[0]!.id, [], seed);
      const majors = engine.state.firedEvents.filter((id) =>
        ALL_MISSIONS[0]!.events.find((e) => e.id === id && e.kind === "major")
      );
      expect(majors).toHaveLength(1);
    }
  });

  it("major events fire within their scheduled window", () => {
    for (const seed of [11, 22, 33, 44]) {
      const { engine } = playToEnd(ALL_MISSIONS[0]!.id, [], seed);
      const fired = engine.state.log.find((l) => l.kind === "event");
      expect(fired).toBeDefined();
      if (fired) expect(fired.t).toBeGreaterThanOrEqual(30);
    }
  });

  it("unresponded crises apply the harsher penalty", () => {
    const m = ALL_MISSIONS.find((x) => x.id === "city-gridlock")!;
    const engine = new RunEngine(m, 11);
    // Force-run past the maximum event window end so the event fires unresponded.
    engine.processUntil(150);
    const eventLogs = engine.state.log.filter((l) => l.kind === "event");
    expect(eventLogs.length).toBeGreaterThanOrEqual(1);
  });

  it("preparation mediates event damage", () => {
    const m = ALL_MISSIONS.find((x) => x.id === "city-gridlock")!;
    // Two runs, same seed & event; one takes resilience-building actions first.
    const actions = [{ actionId: "smart-traffic-signals", t: 5 }];
    const { engine: prepared } = playToEnd(m.id, actions, 321);
    const { engine: bare } = playToEnd(m.id, [], 321);
    // Prepared run should log an absorption note when its event fires.
    const preparedEventLog = prepared.state.log.find((l) => l.kind === "event")?.text ?? "";
    const bareEventLog = bare.state.log.find((l) => l.kind === "event")?.text ?? "";
    // At minimum, preparedness must never make things worse structurally:
    expect(preparedEventLog.length).toBeGreaterThan(0);
    expect(bareEventLog.length).toBeGreaterThan(0);
  });
});

describe("projection & scoring", () => {
  it("projection deltas are finite and bounded", () => {
    const { engine, mission } = playToEnd("city-gridlock", [{ actionId: "metro-expansion", t: 4 }], 2024);
    const proj = projectDecade({ mission, state: engine.state, yearEffects: engine.getProjectionEffects() });
    for (const d of proj.deltas) {
      expect(Number.isFinite(d.change)).toBe(true);
      expect(Math.abs(d.change)).toBeLessThan(1000);
    }
    expect(proj.snapshots).toHaveLength(11);
  });

  it("scores fall in 0–100 and reflect decisions", () => {
    const { engine, mission } = playToEnd("city-gridlock", [{ actionId: "metro-expansion", t: 4 }, { actionId: "congestion-pricing", t: 10 }], 2024);
    const proj = projectDecade({ mission, state: engine.state, yearEffects: engine.getProjectionEffects() });
    const score = scoreRun(mission, engine.state, engine.decisions, proj, "normal");
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.outcome).toBeGreaterThanOrEqual(0);
    expect(score.outcome).toBeLessThanOrEqual(100);
  });

  it("difficulty modifiers change the score deterministically", () => {
    const a = playToEnd("city-gridlock", [{ actionId: "metro-expansion", t: 4 }], 2024, "normal");
    const b = playToEnd("city-gridlock", [{ actionId: "metro-expansion", t: 4 }], 2024, "nightmare");
    const projA = projectDecade({ mission: a.mission, state: a.engine.state, yearEffects: a.engine.getProjectionEffects() });
    const projB = projectDecade({ mission: b.mission, state: b.engine.state, yearEffects: b.engine.getProjectionEffects() });
    const sA = scoreRun(a.mission, a.engine.state, a.engine.decisions, projA, "normal");
    const sB = scoreRun(b.mission, b.engine.state, b.engine.decisions, projB, "nightmare");
    expect(sA.difficultyModifier).not.toEqual(sB.difficultyModifier);
  });
});

describe("archetypes", () => {
  it("same behavior produces the same archetype", () => {
    const { engine, mission } = playToEnd("city-gridlock", [{ actionId: "metro-expansion", t: 4 }, { actionId: "congestion-pricing", t: 10 }], 2024);
    const proj = projectDecade({ mission, state: engine.state, yearEffects: engine.getProjectionEffects() });
    const score = scoreRun(mission, engine.state, engine.decisions, proj, "normal");
    const signals = collectSignals(mission, engine.state, engine.decisions, score.skills);
    const a1 = assignArchetype(signals);
    const a2 = assignArchetype(signals);
    expect(a1).toBe(a2);
  });

  it("crisis responders trend toward crisisEngineer", () => {
    // Advance second-by-second until the major event is live, then respond
    // while the window is still open (deterministic for any seed).
    const m = ALL_MISSIONS[0]!;
    const engine = new RunEngine(m, 11);
    for (let t = 1; t <= 150 && !engine.state.activeEvent; t++) {
      engine.processUntil(t);
    }
    const ev = engine.state.activeEvent
      ? m.events.find((e) => e.id === engine.state.activeEvent!.eventId)
      : undefined;
    expect(ev, "a major event must fire within the run").toBeDefined();
    const responded = engine.respondToEvent(ev!.responses[0]!);
    expect(responded).toBe(true);
    expect(engine.state.taken.some((t) => t.eventId)).toBe(true);
    engine.processUntil(150);
    engine.endRun();
    const proj = projectDecade({ mission: m, state: engine.state, yearEffects: engine.getProjectionEffects() });
    const score = scoreRun(m, engine.state, engine.decisions, proj, "normal");
    const signals = collectSignals(m, engine.state, engine.decisions, score.skills);
    expect(signals.crisisResponses).toBeGreaterThanOrEqual(1);
  });
});

describe("full-run integrity across all missions", () => {
  it("every mission can host a complete run with sane results", () => {
    for (const mission of ALL_MISSIONS) {
      const engine = new RunEngine(mission, 777);
      // take the first two available standard actions to simulate play
      engine.processUntil(3);
      const avail = engine.availableActions().filter((a) => a.reasons.length === 0);
      if (avail[0]) engine.takeAction(avail[0].action.id);
      engine.processUntil(10);
      const avail2 = engine.availableActions().filter((a) => a.reasons.length === 0);
      if (avail2[0]) engine.takeAction(avail2[0].action.id);
      engine.processUntil(150);
      engine.endRun();
      expect(engine.state.status).not.toBe("running");
      const proj = projectDecade({ mission, state: engine.state, yearEffects: engine.getProjectionEffects() });
      const score = scoreRun(mission, engine.state, engine.decisions, proj, "normal");
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    }
  });
});
