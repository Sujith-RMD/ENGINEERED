"use client";

import { getIcon } from "./icons";
import type { ActionDef } from "@/types/game";

function CostChips({ action }: { action: ActionDef }) {
  const budget = action.cost.budget ?? 0;
  const approval = action.cost.approval ?? 0;
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs">
      {budget > 0 && <span className="rounded-sm bg-amber/15 px-1.5 py-0.5 font-bold text-amber">₹{budget}</span>}
      {approval > 0 && <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 font-bold text-accent">🤝 {approval}</span>}
      {budget === 0 && approval === 0 && <span className="rounded-sm bg-line px-1.5 py-0.5 text-muted">FREE</span>}
    </span>
  );
}

export function ActionTile({ action, disabled, reason, onClick, highlight }: {
  action: ActionDef;
  disabled: boolean;
  reason?: string;
  onClick: () => void;
  highlight?: "endgame" | "synergy";
}) {
  const Icon = getIcon(action.icon);
  const risk = action.risks?.[0];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? reason : `${action.title} — ${action.description}`}
      className={`panel relative flex min-h-[118px] w-full flex-col justify-between p-3 text-left transition-all duration-150 ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : highlight === "endgame"
            ? "panel-accent brackets hover:-translate-y-0.5"
            : "hover:-translate-y-0.5 hover:border-line2"
      } ${highlight === "endgame" && !disabled ? "animate-pulse-soft" : ""}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="font-mono text-[13px] font-bold leading-tight tracking-[0.06em]">{action.title}</p>
          </div>
          <CostChips action={action} />
        </div>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted">{action.description}</p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {action.immediate.slice(0, 3).map((e, i) => (
            <span
              key={i}
              className={`rounded-sm px-1 py-0.5 font-mono text-[10px] font-bold ${
                e.delta > 0 ? "bg-good/15 text-good" : "bg-danger/15 text-danger"
              }`}
            >
              {e.delta > 0 ? "+" : ""}{Math.round(e.delta * 10) / 10}
            </span>
          ))}
        </div>
        {risk && (
          <span className="shrink-0 font-mono text-[10px] text-amber" title={risk.note}>
            ⚠ {Math.round(risk.chance * 100)}%
          </span>
        )}
      </div>
      {disabled && reason && (
        <span className="tlabel absolute inset-x-0 bottom-0 truncate bg-void/90 px-2 py-0.5 text-center text-[8px] text-danger">
          {reason}
        </span>
      )}
    </button>
  );
}
