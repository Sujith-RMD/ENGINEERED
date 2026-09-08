import type { Archetype, ArchetypeId, DecisionRecord, MissionDef, RunState, SkillScores } from "@/types/game";

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  systemsEngineer: {
    id: "systemsEngineer",
    name: "THE SYSTEMS ENGINEER",
    title: "You didn't optimize one problem. You optimized the system.",
    description:
      "You improved almost every headline variable at once, refusing to trade one crisis for another.",
    strengths: "Balanced outcomes; nothing was left to rot while you fixed the shiny problem.",
    weaknesses: "Masters of everything often pioneer nothing — your boldest moves were rare.",
  },
  sustainabilityEngineer: {
    id: "sustainabilityEngineer",
    name: "THE SUSTAINABILITY ENGINEER",
    title: "You engineered for the decade, not the deadline.",
    description:
      "Green infrastructure, low pollution, and long-payoff projects dominated your blueprint.",
    strengths: "The projection bends in your favor for years after the clock stops.",
    weaknesses: "Short-term public satisfaction sometimes paid for your long-term bets.",
  },
  crisisEngineer: {
    id: "crisisEngineer",
    name: "THE CRISIS ENGINEER",
    title: "When the system screamed, you were already moving.",
    description:
      "You responded to every emergency — fast — and kept damage contained where others would have bled.",
    strengths: "Under fire, you are the calmest person in the control room.",
    weaknesses: "Firefighting consumed resources that quiet prevention would have used better.",
  },
  resourceEngineer: {
    id: "resourceEngineer",
    name: "THE RESOURCE ENGINEER",
    title: "You did more with less than anyone thought possible.",
    description:
      "Every crore was stretched, every cheap high-leverage action found, every waste avoided.",
    strengths: "Fiscal discipline; you left money on the table and still delivered.",
    weaknesses: "Some problems only money solves — underinvestment showed late.",
  },
  innovator: {
    id: "innovator",
    name: "THE INNOVATOR",
    title: "You took the road that wasn't on the map.",
    description:
      "Unconventional tech, synergy combos, and delayed-payoff experiments defined your run.",
    strengths: "Found leverage others missed; the future compounds in your favor.",
    weaknesses: "Experiments misfire; variance is the price of your ceiling.",
  },
  resilienceEngineer: {
    id: "resilienceEngineer",
    name: "THE RESILIENCE ENGINEER",
    title: "You built a system that shrugged at disasters.",
    description:
      "Buffers, backups, and preparedness first — events hit you and simply bounced off.",
    strengths: "Shock absorption was exceptional; your worst day was manageable.",
    weaknesses: "Armor is heavy: flashier metrics moved slower than your rivals'.",
  },
  urbanist: {
    id: "urbanist",
    name: "THE URBANIST",
    title: "You designed for people, not just pipes.",
    description:
      "Transit, walkability, and public space — the city you built is one people actually want to live in.",
    strengths: "Public satisfaction and livability rose under your watch.",
    weaknesses: "Hard infrastructure occasionally lagged behind the beautiful plans.",
  },
  optimizer: {
    id: "optimizer",
    name: "THE OPTIMIZER",
    title: "Maximum output. Minimum waste. Zero drama.",
    description:
      "You allocated with surgical precision — the right action, the right moment, the right price.",
    strengths: "Resource efficiency near the theoretical limit of this mission.",
    weaknesses: "Pure efficiency can starve resilience and goodwill when shocks arrive.",
  },
  socialEngineer: {
    id: "socialEngineer",
    name: "THE SOCIAL ENGINEER",
    title: "You spent your mandate as carefully as your money.",
    description:
      "Political capital was your currency of choice — persuasion, programs, and public buy-in.",
    strengths: "High approval gave you room to push through hard reforms.",
    weaknesses: "Consensus-building is slow; some crises didn't wait.",
  },
  chaosEngineer: {
    id: "chaosEngineer",
    name: "THE CHAOS ENGINEER",
    title: "Questionable decisions. Survived anyway. Somehow.",
    description:
      "Your run took damage most engineers would avoid — yet the system held together.",
    strengths: "High risk tolerance; occasionally stumbles into brilliant outliers.",
    weaknesses: "The debrief has stories about you. Not all of them flattering.",
  },
};

interface Signals {
  tagCounts: Record<string, number>;
  decisions: DecisionRecord[];
  takenCount: number;
  spent: number;
  budgetLeft: number;
  synergies: number;
  delayedBets: number;
  crisisResponses: number;
  eventsFaced: number;
  failedResponse: boolean;
  failed: boolean;
  skills: SkillScores;
}

export function collectSignals(
  mission: MissionDef,
  state: RunState,
  decisions: DecisionRecord[],
  skills: SkillScores
): Signals {
  const actionsById = new Map(mission.actions.map((a) => [a.id, a]));
  const tagCounts: Record<string, number> = {};
  let spent = 0;
  let synergies = 0;
  let delayedBets = 0;
  for (const d of decisions) {
    const a = actionsById.get(d.actionId);
    if (!a) continue;
    for (const t of a.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    spent += d.cost.budget ?? 0;
    if (a.synergy && state.taken.some((t) => t.actionId === a.synergy!.withActionId)) synergies += 1;
    if ((a.delayed ?? []).some((x) => x.atYear !== undefined)) delayedBets += 1;
  }
  const crisisResponses = decisions.filter((d) => d.eventId).length;
  const eventsFaced = state.firedEvents.length;
  const failedResponse = eventsFaced > crisisResponses;
  return {
    tagCounts,
    decisions,
    takenCount: decisions.length,
    spent,
    budgetLeft: state.metrics.budget ?? 0,
    synergies,
    delayedBets,
    crisisResponses,
    eventsFaced,
    failedResponse,
    failed: state.status === "failed",
    skills,
  };
}

/**
 * Archetype assignment: score every archetype against observed behavior
 * and pick the strongest signal. Never random — same behavior, same
 * archetype, every time.
 */
export function assignArchetype(signals: Signals): ArchetypeId {
  const s = signals.skills;
  const tag = (t: string) => signals.tagCounts[t] ?? 0;

  const scores: Record<ArchetypeId, number> = {
    systemsEngineer: s.systemsThinking * 1.0 + Math.min(tag("transit"), 3) + Math.min(tag("resilience"), 3),
    sustainabilityEngineer: s.sustainability * 1.1 + tag("green") * 2.5,
    crisisEngineer: s.crisisResponse * 1.1 + signals.crisisResponses * 3 + (signals.failedResponse ? -6 : 0),
    resourceEngineer: s.resourceEfficiency * 0.9 + (signals.budgetLeft > 25 ? 8 : 0) + (signals.spent < 40 ? 5 : 0),
    innovator: s.innovation * 1.1 + signals.synergies * 4 + signals.delayedBets * 1.5,
    resilienceEngineer: s.resilience * 1.1 + tag("resilience") * 2.5 + tag("emergency") * 2,
    urbanist: tag("transit") * 4 + tag("green") * 2 + s.socialImpact * 0.5,
    optimizer: s.resourceEfficiency * 0.8 + (signals.takenCount >= 5 ? 8 : 0) + (signals.budgetLeft <= 15 ? 8 : 0),
    socialEngineer: tag("political") * 4 + s.socialImpact * 0.7 + (signals.budgetLeft >= 0 ? 2 : 0),
    chaosEngineer: (signals.failed ? 14 : 0) + (signals.failedResponse ? 6 : 0) + (s.systemsThinking < 40 ? 8 : 0) + (signals.takenCount <= 2 && signals.eventsFaced > 0 ? 6 : 0),
  };

  // The failed run almost always has a story worth telling honestly.
  if (signals.failed) {
    scores.chaosEngineer += 18;
  }

  let best: ArchetypeId = "systemsEngineer";
  let bestScore = -Infinity;
  for (const [id, score] of Object.entries(scores) as [ArchetypeId, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}
