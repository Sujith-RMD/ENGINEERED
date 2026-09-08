import type { MissionDef } from "@/types/game";
import { cityGridlock } from "./city-gridlock";
import { floodline } from "./floodline";
import { lastDrop } from "./last-drop";
import { blackout } from "./blackout";
import { zeroWaste } from "./zero-waste";
import { critical } from "./critical";
import { campus2040 } from "./campus-2040";
import { city2040 } from "./city-2040";
import { fireline } from "./fireline";
import { marsHabitat } from "./mars-habitat";

/** All missions. Adding a mission = adding a file + one line here. */
export const ALL_MISSIONS: MissionDef[] = [
  cityGridlock,
  floodline,
  lastDrop,
  blackout,
  zeroWaste,
  critical,
  campus2040,
  city2040,
  fireline,
  marsHabitat,
];

const REGISTRY = new Map(ALL_MISSIONS.map((m) => [m.id, m]));

export function getMission(id: string): MissionDef | undefined {
  return REGISTRY.get(id);
}

export const MISSION_IDS = ALL_MISSIONS.map((m) => m.id);
