import type {
  ActionDef,
  ActiveEvent,
  DecisionRecord,
  Difficulty,
  Effect,
  EventDef,
  LogEntry,
  MissionDef,
  RunState,
  VariableId,
} from "@/types/game";
import { VARIABLES } from "./variables";
import { makeRng } from "./rng";
import { applyEffects } from "./relationships";

/** Difficulty tuning: multipliers applied to the mission definition. */
export const DIFFICULTY_TUNING: Record<
  Difficulty,
  {
    label: string;
    budgetFactor: number;
    dynamicsFactor: number;
    eventDamageFactor: number;
    ambientChance: number;
    scoreModifier: number;
  }
> = {
  easy: { label: "EASY", budgetFactor: 1.35, dynamicsFactor: 0.6, eventDamageFactor: 0.65, ambientChance: 0.5, scoreModifier: 0.9 },
  normal: { label: "NORMAL", budgetFactor: 1, dynamicsFactor: 1, eventDamageFactor: 1, ambientChance: 1, scoreModifier: 1 },
  hard: { label: "HARD", budgetFactor: 0.8, dynamicsFactor: 1.35, eventDamageFactor: 1.3, ambientChance: 1.5, scoreModifier: 1.08 },
  nightmare: { label: "NIGHTMARE", budgetFactor: 0.6, dynamicsFactor: 1.7, eventDamageFactor: 1.6, ambientChance: 2, scoreModifier: 1.15 },
};

export interface EngineOptions {
  difficulty?: Difficulty;
}

const label = (m: VariableId) => VARIABLES[m]?.label ?? m;
const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const fmtDelta = (e: Effect) => `${label(e.metric)} ${sign(round1(e.delta))}`;

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * The ENGINEERED run engine. Pure TypeScript, zero platform dependencies.
 * The same (mission, seed, decision list) always produces the same run,
 * which lets the server re-simulate a submission instead of trusting the
 * client's score.
 */
export class RunEngine {
  readonly mission: MissionDef;
  readonly difficulty: Difficulty;
  state: RunState;
  decisions: DecisionRecord[] = [];
  private yearEffects: { note: string; atYear: number; effects: Effect[] }[] = [];
  private scheduledMajors: { eventId: string; fireAt: number }[] = [];
  private processedSecond = 0;
  private rng: () => number;
  private tuning: (typeof DIFFICULTY_TUNING)[Difficulty];

  constructor(mission: MissionDef, seed: number, options: EngineOptions = {}) {
    this.mission = mission;
    this.difficulty = options.difficulty ?? "normal";
    this.tuning = DIFFICULTY_TUNING[this.difficulty];
    this.rng = makeRng(seed);

    const metrics = {} as Record<VariableId, number>;
    const vars = new Set<VariableId>([...mission.variables, "budget", "approval"]);
    for (const v of vars) {
      const def = VARIABLES[v];
      const start = mission.startState[v] ?? def.min;
      metrics[v] = v === "budget" ? mission.budget * this.tuning.budgetFactor : start;
    }
    for (const v of Object.keys(metrics) as VariableId[]) {
      metrics[v] = this.clamp(v, metrics[v]);
    }

    this.state = {
      missionId: mission.id,
      difficulty: this.difficulty,
      seed,
      elapsed: 0,
      metrics,
      taken: [],
      cooldowns: {},
      activeEvent: null,
      pendingDelayed: [],
      firedEvents: [],
      log: [],
      status: "running",
      revision: 0,
    };

    this.scheduleMajors();
    this.pushLog("system", `SYSTEM ONLINE — ${mission.title.toUpperCase()}`);
  }

  // ------------------------------------------------------------------ core

  private clamp(metric: VariableId, value: number): number {
    const def = VARIABLES[metric];
    if (!def) return value;
    if (!Number.isFinite(value)) return def.min;
    return Math.min(def.max, Math.max(def.min, value));
  }

  /** Drop effects targeting variables this mission doesn't track (prevents NaN). */
  private sanitize(effects: Effect[]): Effect[] {
    return effects.filter((e) => this.state.metrics[e.metric] !== undefined);
  }

  private pushLog(kind: LogEntry["kind"], text: string, deltas?: Effect[]) {
    this.state.log.push({ seq: this.state.log.length, t: this.state.elapsed, kind, text, deltas });
    this.state.revision += 1;
  }

  private get remaining(): number {
    return Math.max(0, 150 - this.state.elapsed);
  }

  /** Advance the world to `targetSeconds` (integer seconds, in order). */
  processUntil(targetSeconds: number): void {
    if (this.state.status !== "running") return;
    const target = Math.min(150, Math.max(0, Math.floor(targetSeconds)));
    while (this.processedSecond < target && this.state.status === "running") {
      this.processedSecond += 1;
      this.state.elapsed = this.processedSecond;
      this.tickSecond();
    }
  }

  private tickSecond(): void {
    const t = this.processedSecond;
    const m = this.state.metrics;

    // 1. Living-system drift
    for (const [key, rateRaw] of Object.entries(this.mission.dynamics)) {
      const metric = key as VariableId;
      const rate = (rateRaw ?? 0) * this.tuning.dynamicsFactor;
      if (rate !== 0) m[metric] = this.clamp(metric, (m[metric] ?? 0) + rate);
    }

    // 2. Due delayed effects
    const due = this.state.pendingDelayed.filter((p) => p.dueT <= t);
    if (due.length > 0) {
      this.state.pendingDelayed = this.state.pendingDelayed.filter((p) => p.dueT > t);
      for (const d of due) {
        const effects = this.sanitize(d.effects);
        if (effects.length === 0) continue;
        const { waves } = applyEffects(m, effects, (k, v) => this.clamp(k, v));
        this.pushLog("effect", `⏳ ${d.note} — ${effects.map(fmtDelta).join(", ")}`, effects);
        this.logWaves(waves, 1);
      }
    }

    // 3. Scheduled major events
    if (!this.state.activeEvent) {
      const next = this.scheduledMajors.find((s) => s.fireAt <= t);
      if (next) {
        this.scheduledMajors = this.scheduledMajors.filter((s) => s !== next);
        this.fireEvent(next.eventId);
      }
    }

    // 4. Ambient threshold checks (every 5 seconds)
    if (t % 5 === 0) {
      this.checkAmbient();
    }

    // 5. Response window expiry
    const ev = this.state.activeEvent;
    if (ev && !ev.responded && t >= ev.expiresAt) {
      const def = this.mission.events.find((e) => e.id === ev.eventId);
      if (def?.unresponded?.length) {
        const scaled = this.sanitize(def.unresponded).map((e) => ({ ...e, delta: e.delta * this.tuning.eventDamageFactor }));
        const { waves } = applyEffects(m, scaled, (k, v) => this.clamp(k, v));
        this.pushLog("event", `⚠ ${def.title} — NO RESPONSE. ${scaled.map(fmtDelta).join(", ")}`, scaled);
        this.logWaves(waves, 1);
      }
      this.state.activeEvent = null;
      this.pushLog("system", "Crisis window closed.");
    }

    // 6. Failure conditions
    for (const fc of this.mission.failureConditions) {
      if ((m[fc.metric] ?? 100) < fc.below) {
        this.state.status = "failed";
        this.state.failReason = `${label(fc.metric)} collapsed below ${fc.below}`;
        this.pushLog("fail", `🛑 SYSTEM FAILURE — ${label(fc.metric)} below critical threshold ${fc.below}.`);
        return;
      }
    }
  }

  private logWaves(waves: Effect[][], startWave: number): void {
    waves.forEach((wave, i) => {
      if (i < startWave) return;
      const parts = wave.filter((e) => Math.abs(e.delta) >= 0.4).map(fmtDelta);
      if (parts.length > 0) this.pushLog("effect", `  ↳ ripple: ${parts.join(", ")}`, wave);
    });
  }

  // ---------------------------------------------------------------- events

  private scheduleMajors(): void {
    const majors = this.mission.events.filter((e) => e.kind === "major");
    if (majors.length === 0) return;
    const roll = this.rng();
    let total = 0;
    const weights = majors.map((e) => {
      const w = this.effectiveWeight(e);
      total += w;
      return w;
    });
    let pick = roll * total;
    let chosen = majors[majors.length - 1];
    for (let i = 0; i < majors.length; i++) {
      pick -= weights[i] ?? 0;
      if (pick <= 0) {
        chosen = majors[i]!;
        break;
      }
    }
    const window = chosen.window ?? { start: 55, end: 110 };
    const fireAt = window.start + Math.floor(this.rng() * Math.max(1, window.end - window.start));
    this.scheduledMajors.push({ eventId: chosen.id, fireAt });
  }

  private effectiveWeight(e: EventDef): number {
    let w = e.baseWeight ?? 1;
    for (const mod of e.weightMods ?? []) {
      const value = this.state.metrics[mod.metric] ?? 0;
      if (mod.below !== undefined && value < mod.below) w *= mod.multiply;
      if (mod.above !== undefined && value > mod.above) w *= mod.multiply;
    }
    return Math.max(0.05, w);
  }

  private checkAmbient(): void {
    if (this.state.activeEvent) return;
    const ambient = this.mission.events.filter((e) => e.kind === "ambient" && !this.state.firedEvents.includes(e.id));
    for (const e of ambient) {
      if (!e.threshold) continue;
      const value = this.state.metrics[e.threshold.metric] ?? 0;
      const crossed =
        (e.threshold.below !== undefined && value < e.threshold.below) ||
        (e.threshold.above !== undefined && value > e.threshold.above);
      if (crossed) {
        // Ambient events are state-earned but still probabilistic per check.
        if (this.rng() < 0.25 * this.tuning.ambientChance) {
          this.fireEvent(e.id);
          return;
        }
      }
    }
  }

  private fireEvent(eventId: string): void {
    const def = this.mission.events.find((e) => e.id === eventId);
    if (!def || this.state.status !== "running") return;
    const mitigated = this.sanitize(this.mitigate(def.damage));
    const { waves } = applyEffects(this.state.metrics, mitigated, (k, v) => this.clamp(k, v));
    this.state.firedEvents.push(def.id);
    this.state.activeEvent = {
      eventId: def.id,
      firedAt: this.state.elapsed,
      expiresAt: this.state.elapsed + def.responseSeconds,
      responded: false,
    } satisfies ActiveEvent;
    const prepNote = def.mitigation ? this.mitigationNote(def) : "";
    this.pushLog("event", `${def.icon} ${def.title} — ${def.description}${prepNote}`, mitigated);
    this.logWaves(waves, 1);
  }

  private mitigationFactor(def: EventDef): number {
    if (!def.mitigation) return 1;
    const value = this.state.metrics[def.mitigation.metric] ?? 0;
    return 1 - Math.min(0.6, value / 150);
  }

  private mitigate(damage: Effect[]): Effect[] {
    const ev = this.state.activeEvent;
    const def = ev ? this.mission.events.find((e) => e.id === ev.eventId) : undefined;
    const factor = (def ? this.mitigationFactor(def) : 1) * this.tuning.eventDamageFactor;
    return damage.map((e) => ({ ...e, delta: e.delta * factor }));
  }

  private mitigationNote(def: EventDef): string {
    if (!def.mitigation) return "";
    const value = this.state.metrics[def.mitigation.metric] ?? 0;
    const absorbed = Math.round(Math.min(0.6, value / 150) * 100);
    if (absorbed <= 0) return "";
    return ` ${label(def.mitigation.metric)} ${value.toFixed(0)} absorbed ${absorbed}% of the impact.`;
  }

  respondToEvent(actionId: string): boolean {
    const ev = this.state.activeEvent;
    if (!ev || ev.responded) return false;
    const def = this.mission.events.find((e) => e.id === ev.eventId);
    if (!def || !def.responses.includes(actionId)) return false;
    const action = this.mission.actions.find((a) => a.id === actionId);
    if (!action) return false;
    const ok = this.executeAction(action, ev.eventId);
    if (ok) {
      ev.responded = true;
      this.state.activeEvent = null;
    }
    return ok;
  }

  // --------------------------------------------------------------- actions

  availableActions(): { action: ActionDef; reasons: string[] }[] {
    const reasonsFor = (a: ActionDef): string[] => {
      const reasons: string[] = [];
      if (a.scope === "crisisOnly") return ["Crisis response only"];
      if (a.scope === "endgame" && this.remaining > 30) reasons.push("Final decision — unlock at 0:30");
      const uses = this.state.taken.filter((t) => t.actionId === a.id).length;
      if (uses >= (a.maxUses ?? 1)) reasons.push("Already committed");
      if (a.cooldownSeconds && (this.state.cooldowns[a.id] ?? 0) > this.state.elapsed) {
        reasons.push(`Cooling down ${Math.ceil((this.state.cooldowns[a.id]! - this.state.elapsed))}s`);
      }
      for (const c of a.conflictsWith ?? []) {
        if (this.state.taken.some((t) => t.actionId === c)) {
          const other = this.mission.actions.find((x) => x.id === c);
          reasons.push(`Conflicts with ${other?.title ?? c}`);
        }
      }
      for (const req of a.requirements ?? []) {
        if (req.kind === "metricAbove" && (this.state.metrics[req.metric] ?? 0) <= req.value) {
          reasons.push(`Requires ${label(req.metric)} > ${req.value}`);
        }
        if (req.kind === "metricBelow" && (this.state.metrics[req.metric] ?? 0) >= req.value) {
          reasons.push(`Requires ${label(req.metric)} < ${req.value}`);
        }
        if (req.kind === "actionTaken" && !this.state.taken.some((t) => t.actionId === req.actionId)) {
          const other = this.mission.actions.find((x) => x.id === req.actionId);
          reasons.push(`Requires ${other?.title ?? req.actionId}`);
        }
        if (req.kind === "actionNotTaken" && this.state.taken.some((t) => t.actionId === req.actionId)) {
          const other = this.mission.actions.find((x) => x.id === req.actionId);
          reasons.push(`Blocked by ${other?.title ?? req.actionId}`);
        }
      }
      if ((a.cost.budget ?? 0) > (this.state.metrics.budget ?? 0)) reasons.push("Insufficient budget");
      if ((a.cost.approval ?? 0) > (this.state.metrics.approval ?? 0)) reasons.push("Insufficient political capital");
      return reasons;
    };
    return this.mission.actions
      .filter((a) => a.scope === "standard" || a.scope === "endgame")
      .map((action) => ({ action, reasons: reasonsFor(action) }));
  }

  eventResponseOptions(): { action: ActionDef }[] {
    const ev = this.state.activeEvent;
    if (!ev) return [];
    const def = this.mission.events.find((e) => e.id === ev.eventId);
    if (!def) return [];
    return def.responses
      .map((id) => this.mission.actions.find((a) => a.id === id))
      .filter((a): a is ActionDef => Boolean(a))
      .map((action) => ({ action }));
  }

  canTake(actionId: string): { ok: boolean; reasons: string[] } {
    const entry = this.availableActions().find((e) => e.action.id === actionId);
    if (!entry) return { ok: false, reasons: ["Unknown action"] };
    return { ok: entry.reasons.length === 0, reasons: entry.reasons };
  }

  takeAction(actionId: string): boolean {
    if (this.state.status !== "running") return false;
    const action = this.mission.actions.find((a) => a.id === actionId && a.scope !== "crisisOnly");
    if (!action) return false;
    const check = this.canTake(actionId);
    if (!check.ok) return false;
    return this.executeAction(action);
  }

  private executeAction(action: ActionDef, eventId?: string): boolean {
    const before = { ...this.state.metrics };
    const cost = { budget: action.cost.budget ?? 0, approval: action.cost.approval ?? 0 };

    // Spend
    const spend: Effect[] = [];
    if (cost.budget) spend.push({ metric: "budget", delta: -cost.budget });
    if (cost.approval) spend.push({ metric: "approval", delta: -cost.approval });
    if (spend.length) {
      for (const s of spend) {
        this.state.metrics[s.metric] = this.clamp(s.metric, (this.state.metrics[s.metric] ?? 0) + s.delta);
      }
    }

    // Direct + secondary
    const immediate = this.sanitize(action.immediate);
    const { waves } = applyEffects(this.state.metrics, immediate, (k, v) => this.clamp(k, v));
    this.pushLog(
      "action",
      `▸ ${action.title.toUpperCase()}${cost.budget ? ` (₹${cost.budget} Cr)` : ""}${cost.approval ? ` · 🤝${cost.approval}` : ""}${immediate.length ? ` — ${immediate.map(fmtDelta).join(", ")}` : ""}`,
      immediate
    );
    this.logWaves(waves, 1);

    // Synergy bonus — fires regardless of which partner was taken first.
    const synergyBonuses: { withActionId: string; effects: Effect[]; note: string }[] = [];
    if (action.synergy && this.state.taken.some((t) => t.actionId === action.synergy!.withActionId)) {
      synergyBonuses.push(action.synergy);
    }
    for (const other of this.mission.actions) {
      if (other.id !== action.id && other.synergy?.withActionId === action.id) {
        if (this.state.taken.some((t) => t.actionId === other.id)) {
          synergyBonuses.push(other.synergy);
        }
      }
    }
    for (const synergy of synergyBonuses) {
      const synergyEffects = this.sanitize(synergy.effects);
      if (synergyEffects.length === 0) continue;
      const { waves: sw } = applyEffects(this.state.metrics, synergyEffects, (k, v) => this.clamp(k, v));
      this.pushLog("effect", `⚡ SYNERGY — ${synergy.note} (${synergyEffects.map(fmtDelta).join(", ")})`, synergyEffects);
      this.logWaves(sw, 1);
    }

    // Risks (seeded)
    for (const risk of action.risks ?? []) {
      if (this.rng() < risk.chance) {
        const riskEffects = this.sanitize(risk.effects);
        const { waves: rw } = applyEffects(this.state.metrics, riskEffects, (k, v) => this.clamp(k, v));
        this.pushLog("risk", `🎲 RISK — ${risk.note} (${riskEffects.map(fmtDelta).join(", ")})`, riskEffects);
        this.logWaves(rw, 1);
      }
    }

    // Delayed effects
    for (const d of action.delayed ?? []) {
      const effects = this.sanitize(d.effects);
      if (effects.length === 0) continue;
      if (d.delaySeconds !== undefined) {
        this.state.pendingDelayed.push({ dueT: this.state.elapsed + d.delaySeconds, note: d.note, effects });
      } else if (d.atYear !== undefined) {
        this.yearEffects.push({ note: d.note, atYear: d.atYear, effects });
      } else {
        // No schedule given: treat as projection year 5.
        this.yearEffects.push({ note: d.note, atYear: 5, effects });
      }
    }

    // Bookkeeping
    if (action.cooldownSeconds) {
      this.state.cooldowns[action.id] = this.state.elapsed + action.cooldownSeconds;
    }
    this.state.taken.push({ seq: this.state.taken.length, actionId: action.id, t: this.state.elapsed, eventId });
    const consequence = this.buildConsequence(action);
    this.decisions.push({
      seq: this.decisions.length,
      t: this.state.elapsed,
      actionId: action.id,
      eventId,
      consequence,
      stateBefore: before,
      stateAfter: { ...this.state.metrics },
      cost,
    });

    // Immediate ambient re-check (a decision can push the system over a cliff)
    if (!this.state.activeEvent) this.checkAmbient();

    if (this.state.status !== "running") return true;
    return true;
  }

  private buildConsequence(action: ActionDef): string {
    const bits = action.immediate.map(fmtDelta);
    return bits.length > 0 ? bits.join(", ") : action.description;
  }

  /** Effects scheduled to land during the 10-year projection. */
  getProjectionEffects(): { note: string; atYear: number; effects: Effect[] }[] {
    return [...this.yearEffects];
  }

  endRun(): void {
    if (this.state.status === "running") this.state.status = "complete";
  }

  /** Convenience for tests/debugging: run the full 150s with no further input. */
  runToEnd(): void {
    this.processUntil(150);
    this.endRun();
  }
}
