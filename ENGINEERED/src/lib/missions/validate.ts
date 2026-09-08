import type { MissionDef, VariableId } from "@/types/game";
import { VARIABLES } from "@/lib/simulation/variables";

export interface MissionIssue {
  severity: "error" | "warning";
  missionId: string;
  path: string;
  message: string;
}

/**
 * Structural validation for mission data. Errors break the build/test
 * run; warnings flag balance smells without blocking.
 */
export function validateMission(mission: MissionDef, allMissions: MissionDef[]): MissionIssue[] {
  const issues: MissionIssue[] = [];
  const err = (path: string, message: string) => issues.push({ severity: "error", missionId: mission.id, path, message });
  const warn = (path: string, message: string) => issues.push({ severity: "warning", missionId: mission.id, path, message });

  // --- Identity
  if (allMissions.filter((m) => m.id === mission.id).length !== 1) err("id", `Duplicate mission id "${mission.id}"`);
  if (!mission.title?.trim()) err("title", "Missing title");
  if (!mission.tagline?.trim()) err("tagline", "Missing tagline");
  if (!mission.icon?.trim()) err("icon", "Missing icon");
  if (mission.difficulty < 1 || mission.difficulty > 5) err("difficulty", "Must be 1–5");
  for (const [key, value] of Object.entries(mission.briefing)) {
    if (!value?.trim()) err(`briefing.${key}`, "Briefing field is empty");
  }

  // --- Variables & start state
  const vars = new Set(mission.variables);
  if (!vars.has("budget")) err("variables", "Mission must track budget");
  for (const v of mission.variables) {
    if (!VARIABLES[v]) err(`variables`, `Unknown variable "${v}"`);
  }
  if (vars.has("approval") && mission.startState.approval === undefined) {
    err("startState.approval", "Approval is tracked but has no start value");
  }
  for (const v of mission.variables) {
    if (v === "budget") continue;
    const start = mission.startState[v];
    if (start === undefined) {
      err(`startState.${v}`, "Headline variable missing a start value");
      continue;
    }
    if (start < 10 || start > 90) warn(`startState.${v}`, `Start value ${start} is extreme ( crises should start, not be pre-won/lost )`);
    if (start <= 0 || start >= 100) err(`startState.${v}`, "Start value must be strictly inside 0–100");
  }
  const lowStarts = mission.variables.filter((v) => {
    if (v === "budget") return false;
    const def = VARIABLES[v];
    const start = mission.startState[v];
    if (start === undefined || !def) return false;
    return def.higherIsBetter ? start < 45 : start > 55;
  });
  if (lowStarts.length === 0) warn("startState", "No variable starts in crisis territory — the opening 15s needs an obvious problem");

  // --- Dynamics & projection drift
  for (const [key, rate] of Object.entries(mission.dynamics)) {
    if (!vars.has(key as VariableId)) err(`dynamics.${key}`, "Drift targets an untracked variable");
    if (Math.abs(rate ?? 0) > 0.2) err(`dynamics.${key}`, "Per-second drift too strong (|rate| ≤ 0.2)");
  }
  for (const [key, rate] of Object.entries(mission.projectionDrift)) {
    if (!vars.has(key as VariableId)) err(`projectionDrift.${key}`, "Projection drift targets an untracked variable");
    if (Math.abs(rate ?? 0) > 3) err(`projectionDrift.${key}`, "Per-year drift too strong (|rate| ≤ 3)");
  }

  // --- Actions
  const actionIds = new Set(mission.actions.map((a) => a.id)); // full catalog — forward refs allowed
  const seenActionIds = new Set<string>();
  for (const a of mission.actions) {
    const p = `actions.${a.id}`;
    if (seenActionIds.has(a.id)) err(p, "Duplicate action id");
    seenActionIds.add(a.id);
    if (!a.title?.trim()) err(`${p}.title`, "Missing title");
    if (!a.description?.trim()) err(`${p}.description`, "Missing description");
    if (!a.icon?.trim()) err(`${p}.icon`, "Missing icon");
    if (!a.tags?.length) err(`${p}.tags`, "Needs at least one tag");
    const cb = a.cost.budget ?? 0;
    const ca = a.cost.approval ?? 0;
    if (cb < 0 || ca < 0) err(`${p}.cost`, "Costs must be ≥ 0");
    if (cb > mission.budget) warn(`${p}.cost.budget`, "Cost exceeds the entire budget — deliberate trap?");
    if (a.scope !== "crisisOnly" && cb === 0 && ca === 0) {
      warn(`${p}.cost`, "Free action — is this a button, not a decision?");
    }
    if ((a.immediate?.length ?? 0) === 0 && (a.delayed?.length ?? 0) === 0) {
      err(`${p}`, "Action does nothing (no immediate or delayed effects)");
    }
    // Real trade-offs: some cost beyond money, or a genuine downside
    const downside =
      ca > 0 ||
      (a.risks?.length ?? 0) > 0 ||
      (a.delayed ?? []).some((d) => d.effects.some((e) => (VARIABLES[e.metric]?.higherIsBetter ? e.delta < 0 : e.delta > 0))) ||
      (a.immediate ?? []).some((e) => (VARIABLES[e.metric]?.higherIsBetter ? e.delta < 0 : e.delta > 0)) ||
      (a.conflictsWith?.length ?? 0) > 0;
    if (a.scope === "standard" && !downside) {
      warn(p, "No visible downside — every meaningful decision needs a trade-off");
    }
    for (const c of a.conflictsWith ?? []) {
      if (!actionIds.has(c)) err(`${p}.conflictsWith`, `Unknown conflicting action "${c}"`);
    }
    if (a.synergy) {
      if (!actionIds.has(a.synergy.withActionId)) err(`${p}.synergy`, `Unknown synergy partner "${a.synergy.withActionId}"`);
      if (a.synergy.withActionId === a.id) err(`${p}.synergy`, "Cannot synergize with itself");
    }
    for (const d of a.delayed ?? []) {
      const hasRun = d.delaySeconds !== undefined && d.delaySeconds >= 1 && d.delaySeconds <= 149;
      const hasYear = d.atYear !== undefined && d.atYear >= 1 && d.atYear <= 10;
      if (!hasRun && !hasYear) err(`${p}.delayed`, "Delayed effect needs delaySeconds (1–149) or atYear (1–10)");
      for (const e of d.effects) {
        if (!VARIABLES[e.metric]) err(`${p}.delayed`, `Unknown metric "${e.metric}"`);
      }
    }
    for (const r of a.risks ?? []) {
      if (r.chance <= 0 || r.chance >= 1) err(`${p}.risks`, "Risk chance must be strictly between 0 and 1");
    }
    for (const r of a.requirements ?? []) {
      if (r.kind === "metricAbove" || r.kind === "metricBelow") {
        if (!vars.has(r.metric)) err(`${p}.requirements`, `Requirement on untracked metric "${r.metric}"`);
      } else if (r.kind === "actionTaken" || r.kind === "actionNotTaken") {
        if (!actionIds.has(r.actionId)) err(`${p}.requirements`, `Requirement references unknown action "${r.actionId}"`);
      }
    }
    if (a.scope === "endgame") {
      if ((a.maxUses ?? 1) !== 1) err(p, "Endgame choices are one-shot");
    }
  }

  // Endgame needs exactly one exclusive pair
  const endgame = mission.actions.filter((a) => a.scope === "endgame");
  if (endgame.length !== 2) err("actions", "Exactly two endgame choices are required");
  if (endgame.length === 2 && !(endgame[0]!.conflictsWith ?? []).includes(endgame[1]!.id)) {
    err("actions", "Endgame choices must be mutually exclusive");
  }

  // --- Events
  const eventIds = new Set<string>();
  const crisisActions = new Set(mission.actions.filter((a) => a.scope === "crisisOnly").map((a) => a.id));
  const tracked = new Set<VariableId>([...mission.variables, "budget", "approval"]);
  let majorCount = 0;
  for (const e of mission.events) {
    const p = `events.${e.id}`;
    if (eventIds.has(e.id)) err(p, "Duplicate event id");
    eventIds.add(e.id);
    if (!e.title?.trim() || !e.description?.trim()) err(p, "Event needs title and description");
    if (!tracked.has(e.damage?.[0]?.metric as VariableId) && (e.damage?.length ?? 0) === 0) {
      err(`${p}.damage`, "Event needs at least one damage effect");
    }
    for (const d of [...(e.damage ?? []), ...(e.unresponded ?? [])]) {
      if (!tracked.has(d.metric)) err(`${p}.damage`, `Damage targets untracked metric "${d.metric}"`);
    }
    if (e.kind === "major") {
      majorCount += 1;
      if (!e.window || e.window.start >= e.window.end || e.window.end > 150 || e.window.start < 30) {
        err(`${p}.window`, "Major window must satisfy 30 ≤ start < end ≤ 150");
      }
      if (e.responseSeconds < 8 || e.responseSeconds > 25) err(`${p}.responseSeconds`, "Response window should be 8–25s");
    }
    if (e.kind === "ambient") {
      if (!e.threshold) err(`${p}.threshold`, "Ambient events need a threshold trigger");
      else if (!tracked.has(e.threshold.metric)) err(`${p}.threshold`, "Threshold on untracked metric");
      if ((e.responses?.length ?? 0) !== 1) err(`${p}.responses`, "Ambient events take exactly one response");
    }
    if (e.mitigation && !tracked.has(e.mitigation.metric)) err(`${p}.mitigation`, "Mitigation metric not tracked");
    for (const mod of e.weightMods ?? []) {
      if (!tracked.has(mod.metric)) err(`${p}.weightMods`, "Weight modifier on untracked metric");
    }
    for (const rid of e.responses ?? []) {
      if (!crisisActions.has(rid)) err(`${p}.responses`, `Response "${rid}" must be a crisisOnly action in this mission`);
    }
  }
  if (majorCount < 1) err("events", "Every mission needs at least one major crisis");
  const majors = mission.events.filter((e) => e.kind === "major");
  if (majors.length >= 2) {
    const windows = majors.map((e) => e.window!);
    windows.sort((a, b) => a.start - b.start);
    for (let i = 1; i < windows.length; i++) {
      if (windows[i]!.start < windows[i - 1]!.end) {
        warn("events", "Major windows overlap — only one can fire (later one silently dropped)");
      }
    }
  }

  // --- Weights & failure
  let weightSum = 0;
  for (const [key, w] of Object.entries(mission.scoringWeights)) {
    if (!vars.has(key as VariableId)) err(`scoringWeights.${key}`, "Weight on untracked variable");
    if (key === "budget" || key === "approval") err(`scoringWeights.${key}`, "Resources are not scored via weights");
    weightSum += w ?? 0;
  }
  if (weightSum < 90 || weightSum > 110) err("scoringWeights", `Weights sum to ${weightSum}; expected ~100`);
  for (const v of mission.variables) {
    if (v === "budget" || v === "approval") continue;
    if ((mission.scoringWeights[v] ?? 0) <= 0) err(`scoringWeights.${v}`, "Tracked headline variable has no scoring weight");
  }
  for (const fc of mission.failureConditions) {
    if (!tracked.has(fc.metric)) err("failureConditions", "Failure condition on untracked metric");
    if (fc.below < 3 || fc.below > 20) err("failureConditions", "Failure threshold should be in 3–20 (failures must be rare and dramatic)");
  }
  if (mission.failureConditions.length === 0) warn("failureConditions", "No hard-fail state — runs can never be lost mid-run");

  return issues;
}

export function validateRegistry(missions: MissionDef[]): MissionIssue[] {
  const issues: MissionIssue[] = [];
  for (const m of missions) issues.push(...validateMission(m, missions));
  if (missions.length < 5) issues.push({ severity: "error", missionId: "*", path: "registry", message: "At least 5 missions required" });
  return issues;
}
