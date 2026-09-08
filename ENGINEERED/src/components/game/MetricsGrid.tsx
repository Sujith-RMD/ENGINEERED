"use client";

import { VARIABLES } from "@/lib/simulation/variables";
import { metricColor, fmtMetric } from "./format";
import { MetricDelta } from "./HUD";
import type { Effect, MissionDef, RunState, VariableId } from "@/types/game";

/** Headline metric panel with animated bar + delta chips. */
function MetricPanel({ metric, value, deltas, critical }: {
  metric: VariableId;
  value: number | undefined;
  deltas: Effect[];
  critical: boolean;
}) {
  const def = VARIABLES[metric];
  const displayValue = value ?? def.min;
  const pct = Math.max(0, Math.min(100, displayValue));
  const color = metricColor(metric, value);
  const inverted = !def.higherIsBetter;

  return (
    <div
      className={`panel relative overflow-hidden p-3 ${critical ? "panel-danger animate-pulse-soft" : ""}`}
      aria-label={`${def.label}: ${Math.round(displayValue)} out of 100`}
    >
      <MetricDelta deltas={deltas} />
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden>{def.icon}</span>
        <p className="tlabel truncate">{def.label}</p>
      </div>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums" style={{ color }}>
        {fmtMetric(metric, value)}
      </p>
      <div className="meter mt-2 h-1.5">
        <div
          className="meter-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {inverted && <p className="tlabel mt-1 text-[8px] text-dim">LOWER IS BETTER</p>}
    </div>
  );
}

export function MetricsGrid({ mission, state, recentDeltas }: {
  mission: MissionDef;
  state: RunState;
  recentDeltas: Record<string, Effect[]>;
}) {
  const headline = mission.variables.filter((v) => v !== "budget" && v !== "approval");
  const failureMetric = mission.failureConditions[0]?.metric;
  const failureBelow = mission.failureConditions[0]?.below ?? 0;

  return (
    <section aria-label="Current system state" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {headline.map((metric) => {
        const isCritical =
          metric === failureMetric
            ? (state.metrics[metric] ?? 100) < failureBelow + 10
            : false;
        return (
          <MetricPanel
            key={metric}
            metric={metric}
            value={state.metrics[metric]}
            deltas={recentDeltas[metric] ?? []}
            critical={isCritical}
          />
        );
      })}
    </section>
  );
}
