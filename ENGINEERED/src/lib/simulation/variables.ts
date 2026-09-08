import type { VariableDef, VariableId } from "@/types/game";

/**
 * The master variable registry. Missions pick subsets of these; the engine
 * treats them uniformly (clamping, formatting, scoring normalization).
 */
export const VARIABLES: Record<VariableId, VariableDef> = {
  budget: {
    id: "budget",
    label: "BUDGET",
    icon: "₹",
    min: 0,
    max: 500,
    format: "crore",
    higherIsBetter: true,
    meaning: "Spendable funds in ₹ Crore",
  },
  approval: {
    id: "approval",
    label: "POLITICAL CAPITAL",
    icon: "🤝",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Mandate to push difficult, unpopular interventions",
  },
  traffic: {
    id: "traffic",
    label: "TRAFFIC LOAD",
    icon: "🚦",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: false,
    meaning: "Congestion level of the road network",
  },
  publicTransport: {
    id: "publicTransport",
    label: "PUBLIC TRANSPORT",
    icon: "🚌",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Quality and coverage of mass transit",
  },
  waterSecurity: {
    id: "waterSecurity",
    label: "WATER SECURITY",
    icon: "💧",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Reliability of supply vs. demand",
  },
  energyStability: {
    id: "energyStability",
    label: "GRID STABILITY",
    icon: "⚡",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Generation capacity vs. load, backup readiness",
  },
  sustainability: {
    id: "sustainability",
    label: "SUSTAINABILITY",
    icon: "🌱",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Long-term ecological balance of the system",
  },
  pollution: {
    id: "pollution",
    label: "POLLUTION",
    icon: "🌫️",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: false,
    meaning: "Air, water and soil contamination",
  },
  infrastructure: {
    id: "infrastructure",
    label: "INFRASTRUCTURE",
    icon: "🏗️",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Condition and capacity of physical assets",
  },
  resilience: {
    id: "resilience",
    label: "RESILIENCE",
    icon: "🛡️",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Capacity to absorb shocks without collapse",
  },
  citizenSatisfaction: {
    id: "citizenSatisfaction",
    label: "PUBLIC SATISFACTION",
    icon: "👥",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Public approval of the engineer's stewardship",
  },
  publicHealth: {
    id: "publicHealth",
    label: "PUBLIC HEALTH",
    icon: "🏥",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Population wellbeing and medical capacity",
  },
  innovation: {
    id: "innovation",
    label: "INNOVATION",
    icon: "💡",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Technological capability of the system",
  },
  emergencyReadiness: {
    id: "emergencyReadiness",
    label: "EMERGENCY READINESS",
    icon: "🚨",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Preparedness for acute disasters",
  },
  economicEfficiency: {
    id: "economicEfficiency",
    label: "ECONOMIC EFFICIENCY",
    icon: "📈",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Productivity and fiscal health of the system",
  },
  fireSpread: {
    id: "fireSpread",
    label: "FIRE SPREAD",
    icon: "🔥",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: false,
    meaning: "Intensity and reach of the wildfire front",
  },
  oxygen: {
    id: "oxygen",
    label: "OXYGEN MARGIN",
    icon: "🫁",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Life-support reserve above colony demand",
  },
  wasteCapacity: {
    id: "wasteCapacity",
    label: "WASTE CAPACITY",
    icon: "🗑️",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: true,
    meaning: "Remaining processing and landfill headroom",
  },
  floodDepth: {
    id: "floodDepth",
    label: "FLOOD DEPTH",
    icon: "🌊",
    min: 0,
    max: 100,
    format: "pct",
    higherIsBetter: false,
    meaning: "Depth of standing floodwater across the city",
  },
};

export const MISSION_DURATION_SECONDS = 150;
/** The endgame dilemma unlocks when this many seconds remain. */
export const ENDGAME_UNLOCK_AT_REMAINING = 30;
/** Secondary (relationship) passes run on effect application, damped. */
export const SECONDARY_WAVE_DAMPING = 0.5;
export const SECONDARY_MAX_WAVES = 3;
/** Minimum |delta| for a relationship to keep propagating. */
export const SECONDARY_PROPAGATION_FLOOR = 0.4;
/** Ambient-event threshold checks run every N seconds. */
export const THRESHOLD_CHECK_INTERVAL = 5;
/** Events never drop a metric below this floor in a single hit. */
export const EVENT_DAMAGE_FLOOR = 5;
/** Hard stop tolerance for submissions (client jitter). */
export const TIMER_TOLERANCE_SECONDS = 3;
