import { VARIABLES } from "@/lib/simulation/variables";
import type { Effect, VariableId } from "@/types/game";

export function fmtMetric(metric: VariableId, value: number | undefined): string {
  const def = VARIABLES[metric];
  if (!def) return "—";
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (def.format === "crore") return `₹${value.toFixed(1)} Cr`;
  return Math.round(value).toString();
}

export function fmtDeltaChip(e: Effect): { text: string; good: boolean } {
  const def = VARIABLES[e.metric];
  const higher = def?.higherIsBetter ?? true;
  const good = higher ? e.delta > 0 : e.delta < 0;
  return { text: `${e.delta > 0 ? "+" : ""}${Math.round(e.delta * 10) / 10}`, good };
}

export function metricColor(metric: VariableId, value: number | undefined): string {
  const def = VARIABLES[metric];
  if (!def || value === undefined) return "#5b6f94";
  const v = def.higherIsBetter ? value : 100 - value;
  if (v >= 60) return "#34d399";
  if (v >= 35) return "#fbbf24";
  return "#fb4d63";
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
