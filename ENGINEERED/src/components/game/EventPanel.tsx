"use client";

import { motion } from "motion/react";
import { getIcon } from "./icons";
import { ActionTile } from "./ActionTile";
import type { ActionDef, EventDef, RunState } from "@/types/game";

/** The live crisis console: event headline + response window countdown. */
export function EventPanel({ event, state, options, onRespond }: {
  event: EventDef;
  state: RunState;
  options: { action: ActionDef }[];
  onRespond: (actionId: string) => void;
}) {
  const active = state.activeEvent;
  if (!active) return null;
  const secondsLeft = Math.max(0, Math.ceil(active.expiresAt - state.elapsed));
  const windowPct = Math.max(0, Math.min(100, (secondsLeft / event.responseSeconds) * 100));
  const Icon = getIcon(options[0]?.action.icon ?? "Siren");

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="panel panel-danger brackets overflow-hidden"
      aria-live="assertive"
      aria-label={`Crisis: ${event.title}`}
    >
      <div className="flex items-center justify-between border-b border-danger/40 bg-danger/10 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>{event.icon}</span>
          <p className="font-mono text-sm font-bold tracking-[0.18em] text-danger">{event.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-2xl font-bold tabular-nums text-danger">{secondsLeft}s</p>
          <Icon className="h-5 w-5 text-danger" aria-hidden />
        </div>
      </div>
      <div className="h-1 bg-line">
        <div className="h-full bg-danger transition-[width] duration-300 ease-linear" style={{ width: `${windowPct}%` }} />
      </div>
      <div className="p-4">
        <p className="text-sm text-fg">{event.description}</p>
        <p className="mt-1 text-xs text-dim">Choose a response — the window is closing. No response = unmanaged damage.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map(({ action }) => (
            <ActionTile
              key={action.id}
              action={action}
              disabled={false}
              onClick={() => onRespond(action.id)}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
