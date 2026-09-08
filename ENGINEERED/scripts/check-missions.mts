/**
 * Mission data validator CLI.
 * Usage: npx tsx scripts/check-missions.mts floodline last-drop blackout
 * Exits 1 if any mission has validation errors.
 */
import { validateMission } from "../src/lib/missions/validate";
import type { MissionDef } from "../src/types/game";

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: npx tsx scripts/check-missions.mts <mission-id> [...]");
  process.exit(2);
}

const missions: MissionDef[] = [];
for (const id of ids) {
  const mod = (await import(`../src/data/missions/${id}.ts`)) as Record<string, unknown>;
  const key = Object.keys(mod).find((k) => !k.startsWith("__"))!;
  missions.push(mod[key] as MissionDef);
}

let errorCount = 0;
let warningCount = 0;
for (const mission of missions) {
  const issues = validateMission(mission, missions);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  errorCount += errors.length;
  warningCount += warnings.length;
  console.log(`\n=== ${mission.id} — ${errors.length} errors, ${warnings.length} warnings ===`);
  for (const e of errors) console.log(`  ERROR   ${e.path}: ${e.message}`);
  for (const w of warnings) console.log(`  warning ${w.path}: ${w.message}`);
}

console.log(`\nTotal: ${errorCount} errors, ${warningCount} warnings`);
process.exit(errorCount > 0 ? 1 : 0);
