/**
 * ENGINEERED — shared client library.
 * Thin data-loading layer around the game registry: the mission list is
 * static data; "enabled" filtering only applies when the DB answers.
 */
import { ALL_MISSIONS } from "@/data/missions";

export interface MissionCardData {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  difficulty: number;
  description: string;
  primaryObjective: string;
  startSnapshot: { label: string; value: number; icon: string }[];
}

export function missionCards(): MissionCardData[] {
  return ALL_MISSIONS.map((m) => ({
    id: m.id,
    title: m.title,
    tagline: m.tagline,
    icon: m.icon,
    difficulty: m.difficulty,
    description: m.description,
    primaryObjective: m.primaryObjective,
    startSnapshot: m.variables
      .filter((v) => v !== "budget" && v !== "approval")
      .slice(0, 4)
      .map((v) => {
        const labels: Record<string, { label: string; icon: string }> = {
          traffic: { label: "TRAFFIC", icon: "🚦" },
          publicTransport: { label: "TRANSIT", icon: "🚌" },
          pollution: { label: "POLLUTION", icon: "🌫️" },
          waterSecurity: { label: "WATER", icon: "💧" },
          energyStability: { label: "ENERGY", icon: "⚡" },
          sustainability: { label: "SUSTAIN", icon: "🌱" },
          infrastructure: { label: "INFRA", icon: "🏗️" },
          resilience: { label: "RESILIENCE", icon: "🛡️" },
          citizenSatisfaction: { label: "SATISFACTION", icon: "👥" },
          publicHealth: { label: "HEALTH", icon: "🏥" },
          economicEfficiency: { label: "ECONOMY", icon: "📈" },
          emergencyReadiness: { label: "READINESS", icon: "🚨" },
          fireSpread: { label: "FIRE SPREAD", icon: "🔥" },
          oxygen: { label: "OXYGEN", icon: "🫁" },
          wasteCapacity: { label: "WASTE CAP.", icon: "🗑️" },
          innovation: { label: "INNOVATION", icon: "💡" },
        };
        const meta = labels[v] ?? { label: v.toUpperCase(), icon: "📊" };
        return { ...meta, value: m.startState[v] ?? 50 };
      }),
  }));
}
