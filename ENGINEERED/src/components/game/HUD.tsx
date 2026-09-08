"use client";

import { fmtClock, fmtMetric } from "./format";
import type { Effect, MissionDef, RunState, VariableId } from "@/types/game";

export function HUD({ mission, state, remaining, offline }: {
  mission: MissionDef;
  state: RunState;
  remaining: number;
  offline: boolean;
}) {
  const urgent = remaining <= 10;
  const warning = remaining <= 30 && remaining > 10;
  const timerColor = urgent ? "text-danger" : warning ? "text-amber" : "text-fg";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-5 py-3">
        <div className="hidden sm:block">
          <p className="font-mono text-sm font-bold tracking-[0.2em] text-accent">ENGINEERED</p>
          <p className="tlabel">LIVE SIMULATION</p>
        </div>
        <div className="hidden items-center gap-2 border-l border-line pl-6 md:flex">
          <span className="text-2xl" aria-hidden>{mission.icon}</span>
          <div>
            <p className="font-mono text-sm font-bold tracking-[0.12em]">{mission.title}</p>
            <p className="tlabel">{state.difficulty.toUpperCase()}{offline ? " · OFFLINE" : ""}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-6">
          <div className="text-right">
            <p className="tlabel">BUDGET</p>
            <p className="font-mono text-lg font-bold text-fg">{fmtMetric("budget", state.metrics.budget)}</p>
          </div>
          <div className="text-right">
            <p className="tlabel">CAPITAL</p>
            <p className="font-mono text-lg font-bold text-fg">{fmtMetric("approval", state.metrics.approval)}</p>
          </div>
          <div
            className={`rounded-sm border px-4 py-1.5 text-right ${
              urgent ? "border-danger bg-danger/10" : warning ? "border-amber/60 bg-amber/5" : "border-line2"
            }`}
            role="timer"
            aria-label={`${Math.ceil(remaining)} seconds remaining`}
          >
            <p className={`font-mono text-4xl font-bold leading-none tracking-[0.08em] tabular-nums ${timerColor} ${urgent ? "animate-pulse-soft" : ""}`}>
              {fmtClock(remaining)}
            </p>
            <p className="tlabel mt-0.5 text-[8px]">T-MINUS</p>
          </div>
        </div>
      </div>
      {/* Clock progress rail */}
      <div className="h-[3px] w-full bg-line/60">
        <div
          className={`h-full transition-[width] duration-300 ease-linear ${urgent ? "bg-danger" : warning ? "bg-amber" : "bg-accent"}`}
          style={{ width: `${(remaining / 150) * 100}%` }}
        />
      </div>
    </header>
  );
}

export function MetricDelta({ deltas }: { deltas: Effect[] }) {
  return (
    <span className="pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-1">
      {deltas.slice(0, 3).map((d, i) => {
        const positive = d.delta > 0;
        return (
          <span
            key={`${d.metric}-${i}`}
            className={`animate-rise rounded-sm px-1.5 py-0.5 font-mono text-xs font-bold ${
              positive ? "bg-good/20 text-good" : "bg-danger/20 text-danger"
            }`}
          >
            {positive ? "▲" : "▼"} {Math.abs(Math.round(d.delta * 10) / 10)}
          </span>
        );
      })}
    </span>
  );
}

export type { VariableId };
