/**
 * ENGINEERED — core shared types.
 *
 * The simulation engine is pure TypeScript: it never imports React,
 * Next.js, or the database. Missions are data files that satisfy these
 * types, so adding a mission never requires touching the engine.
 */

export type Difficulty = "easy" | "normal" | "hard" | "nightmare";

export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "nightmare"];

/** The reusable simulation vocabulary. Not every mission uses every variable. */
export type VariableId =
  | "budget"
  | "approval"
  | "traffic"
  | "publicTransport"
  | "waterSecurity"
  | "energyStability"
  | "sustainability"
  | "pollution"
  | "infrastructure"
  | "resilience"
  | "citizenSatisfaction"
  | "publicHealth"
  | "innovation"
  | "emergencyReadiness"
  | "economicEfficiency"
  | "fireSpread"
  | "oxygen"
  | "wasteCapacity"
  | "floodDepth";

export interface VariableDef {
  id: VariableId;
  label: string;
  icon: string; // emoji glyph for metric chips
  min: number;
  max: number;
  format: "pct" | "crore";
  higherIsBetter: boolean;
  meaning: string;
}

export interface Effect {
  metric: VariableId;
  delta: number;
}

/** One labeled bundle of effects that lands later. */
export interface DelayedEffect {
  note: string;
  /** Lands during the run, this many seconds after the action. */
  delaySeconds?: number;
  /** Lands during the 10-year projection, in this year (1–10). */
  atYear?: number;
  effects: Effect[];
}

export interface RiskDef {
  /** 0..1 chance of firing when the action is taken (seeded, reproducible). */
  chance: number;
  effects: Effect[];
  note: string;
}

export type Requirement =
  | { kind: "metricAbove"; metric: VariableId; value: number }
  | { kind: "metricBelow"; metric: VariableId; value: number }
  | { kind: "actionTaken"; actionId: string }
  | { kind: "actionNotTaken"; actionId: string };

export type ActionTag =
  | "transit"
  | "roads"
  | "green"
  | "water"
  | "energy"
  | "waste"
  | "digital"
  | "health"
  | "emergency"
  | "political"
  | "industrial"
  | "space"
  | "resilience"
  | "innovation"
  | "hidden-strength";

export interface ActionDef {
  id: string;
  title: string;
  /** One short line: what it does. Shown on the button. */
  description: string;
  /** Lucide icon name. */
  icon: string;
  tags: ActionTag[];
  cost: {
    budget?: number; // ₹ Cr
    approval?: number; // political capital
  };
  /** Applied the moment the action is confirmed. */
  immediate: Effect[];
  /** Lands later (during the run or during the 10-year projection). */
  delayed?: DelayedEffect[];
  /** Seeded probability side-effects, resolved at execution and shown in the feed. */
  risks?: RiskDef[];
  requirements?: Requirement[];
  /** Mutually exclusive action ids. */
  conflictsWith?: string[];
  /** Bonus that applies if BOTH this action and `withActionId` are taken. */
  synergy?: { withActionId: string; effects: Effect[]; note: string };
  /** Seconds before this action can be taken again. Omit => one-shot. */
  cooldownSeconds?: number;
  /** Total times it can be taken. Default 1. */
  maxUses?: number;
  scope: "standard" | "crisisOnly" | "endgame";
}

export interface EventWeightMod {
  metric: VariableId;
  below?: number;
  above?: number;
  multiply: number;
}

export interface EventDef {
  id: string;
  title: string;
  icon: string;
  description: string; // one short line, spectator-readable
  kind: "major" | "ambient";
  /** Major events: the seconds-window in which this event may fire. */
  window?: { start: number; end: number };
  baseWeight?: number;
  /** State-dependent weighting so crises feel earned, not random. */
  weightMods?: EventWeightMod[];
  /** Ambient events: fire when the metric crosses this band. */
  threshold?: { metric: VariableId; below?: number; above?: number };
  /** Preparedness mediation: damage is scaled by (1 - value/150), capped at 0.6 reduction. */
  mitigation?: { metric: VariableId };
  /** Impact applied immediately when the event fires (already mitigated). */
  damage: Effect[];
  /** Extra cascade if the window expires with no response. */
  unresponded?: Effect[];
  /** crisisOnly action ids offered as responses. */
  responses: string[];
  /** Seconds the response window stays open. */
  responseSeconds: number;
}

export interface MissionDef {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  /** 1–5 intrinsic difficulty badge. */
  difficulty: number;
  description: string;
  briefing: {
    situation: string;
    objective: string;
    warning: string;
  };
  primaryObjective: string;
  secondaryObjectives: string[];
  /** Headline variables displayed on the dashboard (budget included). */
  variables: VariableId[];
  startState: Partial<Record<VariableId, number>>;
  /** Passive per-second drift of the living system (negative = decays). */
  dynamics: Partial<Record<VariableId, number>>;
  budget: number;
  actions: ActionDef[];
  events: EventDef[];
  /** Baseline per-year drift during the 10-year projection. */
  projectionDrift: Partial<Record<VariableId, number>>;
  /** Scoring weights over visible metrics; should sum to ~100. */
  scoringWeights: Partial<Record<VariableId, number>>;
  /** Hard-fail states (checked every tick). */
  failureConditions: { metric: VariableId; below: number }[];
  successConditions: string[];
  /** Behavior tags that this mission's archetypes tend to reward. */
  archetypeHints?: string[];
}

// ---------------------------------------------------------------------------
// Runtime state (serializable — stored in DB, re-simulated server-side)
// ---------------------------------------------------------------------------

export type RunStatus = "running" | "failed" | "complete";

export interface TakenAction {
  seq: number;
  actionId: string;
  /** Mission-clock seconds when taken. */
  t: number;
  eventId?: string;
}

export interface ActiveEvent {
  eventId: string;
  firedAt: number;
  /** Mission-clock seconds when the response window closes. */
  expiresAt: number;
  responded: boolean;
}

export interface LogEntry {
  seq: number;
  t: number;
  kind: "action" | "effect" | "event" | "response" | "threshold" | "risk" | "system" | "fail";
  text: string;
  /** Metric deltas associated with this entry, for the UI delta chips. */
  deltas?: Effect[];
}

export interface RunState {
  missionId: string;
  difficulty: Difficulty;
  seed: number;
  /** Mission clock, seconds elapsed (0–150). */
  elapsed: number;
  metrics: Record<VariableId, number>;
  taken: TakenAction[];
  cooldowns: Record<string, number>; // actionId -> earliest t it may be used again
  activeEvent: ActiveEvent | null;
  /** Pending within-run delayed effects: dueT -> effects. */
  pendingDelayed: { dueT: number; note: string; effects: Effect[] }[];
  /** Ambient events already fired (prevents refiring). */
  firedEvents: string[];
  log: LogEntry[];
  status: RunStatus;
  failReason?: string;
  /** Bumped whenever a decision/event mutates state; used for UI cache keys. */
  revision: number;
}

export interface DecisionRecord {
  seq: number;
  t: number;
  actionId: string;
  eventId?: string;
  consequence: string;
  stateBefore: Record<string, number>;
  stateAfter: Record<string, number>;
  cost: { budget?: number; approval?: number };
}

// ---------------------------------------------------------------------------
// Projection / scoring / results
// ---------------------------------------------------------------------------

export interface ProjectionSnapshot {
  year: number;
  metrics: Record<string, number>;
}

export interface ProjectionResult {
  snapshots: ProjectionSnapshot[]; // start, yr1..yr10
  finalMetrics: Record<string, number>;
  /** Change vs. the state at t=0, in percentage terms. */
  deltas: { metric: VariableId; label: string; icon: string; change: number; higherIsBetter: boolean }[];
  storyBeats: string[];
}

export interface SkillScores {
  systemsThinking: number;
  innovation: number;
  resourceEfficiency: number;
  sustainability: number;
  socialImpact: number;
  resilience: number;
  crisisResponse: number;
  longTermPlanning: number;
}

export interface ScoreResult {
  overall: number;
  outcome: number; // weighted mission outcome 0-100
  skills: SkillScores;
  /** Difficulty modifier applied (for display transparency in admin). */
  difficultyModifier: number;
}

export type ArchetypeId =
  | "systemsEngineer"
  | "sustainabilityEngineer"
  | "crisisEngineer"
  | "resourceEngineer"
  | "innovator"
  | "resilienceEngineer"
  | "urbanist"
  | "optimizer"
  | "socialEngineer"
  | "chaosEngineer";

export interface Archetype {
  id: ArchetypeId;
  name: string;
  title: string; // short epithet
  description: string;
  strengths: string;
  weaknesses: string;
}

export interface Insight {
  title: string;
  text: string;
}

export interface RunResult {
  missionId: string;
  difficulty: Difficulty;
  score: ScoreResult;
  archetype: Archetype;
  projection: ProjectionResult;
  finalState: Record<string, number>;
  achievement: Insight;
  mistake: Insight;
  decisions: DecisionRecord[];
  log: LogEntry[];
}

/** Payload sent by the client when a run finishes; server re-simulates it. */
export interface RunSubmission {
  sessionId: string;
  playerName?: string;
  /** Decisions in mission-clock order. */
  actions: { actionId: string; t: number; eventId?: string }[];
}
