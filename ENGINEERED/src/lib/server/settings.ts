import { prisma } from "@/lib/database/db";
import { MISSION_IDS } from "@/data/missions";

const KEY = "enabledMissions";

/**
 * Which missions the stall has enabled. Falls back to "all enabled"
 * whenever the database is unreachable or unset — the show goes on.
 */
export async function getEnabledMissionIds(): Promise<string[]> {
  try {
    const row = await prisma.adminSetting.findUnique({ where: { key: KEY } });
    const value = row?.value as { ids?: unknown } | undefined;
    if (value && Array.isArray(value.ids)) {
      const valid = value.ids.filter((id): id is string => typeof id === "string" && MISSION_IDS.includes(id));
      if (valid.length > 0) return valid;
    }
  } catch {
    // database unavailable — keep every mission playable
  }
  return MISSION_IDS;
}

export async function setEnabledMissionIds(ids: string[]): Promise<void> {
  const valid = ids.filter((id) => MISSION_IDS.includes(id));
  const value = valid.length > 0 ? { ids: valid } : { ids: [...MISSION_IDS] };
  await prisma.adminSetting.upsert({
    where: { key: KEY },
    update: { value: value as object },
    create: { key: KEY, value: value as object },
  });
}
