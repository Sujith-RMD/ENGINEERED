"use client";

import { fmtDeltaChip } from "./format";
import type { LogEntry } from "@/types/game";

const KIND_STYLE: Record<LogEntry["kind"], string> = {
  action: "text-fg",
  effect: "text-muted",
  event: "text-danger font-bold",
  response: "text-accent font-bold",
  threshold: "text-amber",
  risk: "text-amber",
  system: "text-dim",
  fail: "text-danger font-bold",
};

const KIND_PREFIX: Record<LogEntry["kind"], string> = {
  action: "▸",
  effect: " ",
  event: "!!",
  response: "▣",
  threshold: "⚠",
  risk: "🎲",
  system: "··",
  fail: "✖",
};

export function Feed({ log, max = 7 }: { log: LogEntry[]; max?: number }) {
  const tail = log.slice(-max).reverse();
  return (
    <section className="panel min-h-[168px] p-3" aria-label="System feed" aria-live="polite">
      <p className="tlabel mb-2">// SYSTEM FEED</p>
      <ul className="space-y-1 font-mono text-[11px] leading-relaxed">
        {tail.map((entry) => (
          <li key={entry.seq} className={`${KIND_STYLE[entry.kind]} flex gap-2`}>
            <span className="shrink-0 text-dim tabular-nums" aria-hidden>
              {String(Math.floor(entry.t / 60)).padStart(1, "0")}:{String(entry.t % 60).padStart(2, "0")}
            </span>
            <span className="shrink-0 opacity-70" aria-hidden>{KIND_PREFIX[entry.kind]}</span>
            <span className="min-w-0">
              {entry.text}
              {entry.deltas && entry.deltas.length > 0 && (
                <span className="ml-2 inline-flex flex-wrap gap-1">
                  {entry.deltas.slice(0, 4).map((d, i) => {
                    const chip = fmtDeltaChip(d);
                    return (
                      <span key={i} className={chip.good ? "text-good" : "text-danger"}>
                        {chip.text}
                      </span>
                    );
                  })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
