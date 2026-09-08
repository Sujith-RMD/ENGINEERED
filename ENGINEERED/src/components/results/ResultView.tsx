"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Copy, Loader2, RotateCcw } from "lucide-react";
import type { RunResult } from "@/types/game";

export type DisplayResult = Omit<RunResult, "decisions" | "log">;

export interface SubmitOutcome {
  shareId?: string;
  rank?: { today: number; mission: number };
  error?: string;
  offline?: boolean;
}

function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs]);
  return value;
}

const SKILL_LABELS: [keyof RunResult["score"]["skills"], string][] = [
  ["systemsThinking", "SYSTEMS"],
  ["innovation", "INNOVATION"],
  ["resourceEfficiency", "EFFICIENCY"],
  ["sustainability", "SUSTAIN"],
  ["socialImpact", "SOCIAL"],
  ["resilience", "RESILIENCE"],
  ["crisisResponse", "CRISIS"],
  ["longTermPlanning", "LONG-TERM"],
];

export function ResultView({
  result,
  missionTitle,
  missionIcon,
  rank,
  shareId,
  offline,
  submitError,
  locked,
  qrDataUrl,
  onSubmitName,
  onRestart,
  onMenu,
}: {
  result: DisplayResult;
  missionTitle: string;
  missionIcon: string;
  rank?: { today: number; mission: number };
  shareId?: string;
  offline?: boolean;
  submitError?: string | null;
  locked?: boolean;
  qrDataUrl?: string;
  onSubmitName?: (name: string) => Promise<SubmitOutcome>;
  onRestart?: () => void;
  onMenu?: () => void;
}) {
  const score = useCountUp(result.score.overall);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(rank));
  const [error, setError] = useState<string | null>(submitError ?? null);
  const [qr, setQr] = useState<string | undefined>(qrDataUrl);

  const shareUrl = useMemo(() => {
    if (!shareId) return null;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/results/${shareId}`;
  }, [shareId]);

  useEffect(() => {
    if (!shareUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(shareUrl, { margin: 1, width: 160, color: { dark: "#22d3ee", light: "#04060b" } });
        if (!cancelled) setQr(url);
      } catch {
        // QR is decorative; link still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  async function handleSubmit() {
    if (!onSubmitName || submitting) return;
    setSubmitting(true);
    setError(null);
    const outcome = await onSubmitName(name.trim() || "ENGINEER");
    if (outcome.error) setError(outcome.error);
    else setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel panel-accent brackets p-6">
        <p className="tlabel">// DEBRIEF — 10-YEAR PROJECTION RESOLVED</p>
        <h1 className="mt-2 font-mono text-4xl font-bold tracking-[0.12em]">
          YOUR SYSTEM — 2046
        </h1>
        <p className="mt-1 text-sm text-muted">
          <span className="mr-2" aria-hidden>{missionIcon}</span>
          {missionTitle} · {result.difficulty.toUpperCase()} · {shareId ? `RUN ${shareId}` : "LOCAL RUN"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {result.projection.deltas.map((d) => {
            const improving = d.higherIsBetter ? d.change > 0 : d.change < 0;
            const flat = Math.abs(d.change) < 0.5;
            return (
              <div key={d.metric} className="rounded-sm border border-line bg-void/60 p-3 text-center">
                <div className="text-base" aria-hidden>{d.icon}</div>
                <p className={`font-mono text-xl font-bold ${flat ? "text-muted" : improving ? "text-good" : "text-danger"}`}>
                  {flat ? "·" : d.change > 0 ? "▲" : "▼"} {Math.abs(d.change).toFixed(0)}%
                </p>
                <p className="tlabel mt-1 truncate text-[8px]">{d.label}</p>
              </div>
            );
          })}
        </div>

        {result.projection.storyBeats.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-muted">
            {result.projection.storyBeats.slice(0, 3).map((beat, i) => (
              <li key={i} className="flex gap-2"><span className="text-accent">▸</span>{beat}</li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Score + skills + archetype */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="panel p-6 text-center">
          <p className="tlabel">ENGINEER SCORE</p>
          <p className="mt-2 font-mono text-7xl font-bold tabular-nums text-accent" style={{ textShadow: "0 0 36px rgba(34,211,238,0.35)" }}>
            {score}
          </p>
          <p className="tlabel mt-1">OUTCOME {result.score.outcome} · MODIFIER ×{result.score.difficultyModifier.toFixed(2)}</p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {SKILL_LABELS.map(([key, label]) => (
              <div key={key} title={label}>
                <div className="meter h-1.5">
                  <div className="meter-fill bg-accent" style={{ width: `${result.score.skills[key]}%` }} />
                </div>
                <p className="tlabel mt-1 text-[8px]">{label} {result.score.skills[key]}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="panel panel-accent brackets p-6">
          <p className="tlabel">// ARCHETYPE ASSIGNED</p>
          <h2 className="mt-2 font-mono text-2xl font-bold tracking-[0.1em] text-accent">{result.archetype.name}</h2>
          <p className="mt-2 text-lg italic text-fg">“{result.archetype.title}”</p>
          <p className="mt-3 text-sm text-muted">{result.archetype.description}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="tlabel text-good">STRENGTHS</p>
              <p className="mt-1 text-muted">{result.archetype.strengths}</p>
            </div>
            <div>
              <p className="tlabel text-danger">WEAKNESSES</p>
              <p className="mt-1 text-muted">{result.archetype.weaknesses}</p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Achievement / mistake */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }} className="panel border-good/40 p-5">
          <p className="tlabel text-good">BIGGEST ACHIEVEMENT</p>
          <h3 className="mt-1 font-mono text-lg font-bold">{result.achievement.title}</h3>
          <p className="mt-1 text-sm text-muted">{result.achievement.text}</p>
        </motion.section>
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="panel border-danger/40 p-5">
          <p className="tlabel text-danger">BIGGEST MISTAKE</p>
          <h3 className="mt-1 font-mono text-lg font-bold">{result.mistake.title}</h3>
          <p className="mt-1 text-sm text-muted">{result.mistake.text}</p>
        </motion.section>
      </div>

      {/* Leaderboard + share */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.36 }} className="panel p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-6">
            <div>
              <p className="tlabel">TODAY&apos;S RANK</p>
              <p className="font-mono text-5xl font-bold text-fg">{rank ? `#${rank.today}` : submitted ? "—" : "?"}</p>
            </div>
            <div>
              <p className="tlabel">MISSION RANK</p>
              <p className="font-mono text-2xl font-bold text-muted">{rank ? `#${rank.mission}` : "—"}</p>
            </div>
          </div>

          {!locked && !submitted && (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="tlabel">SIGN THE BOARD — YOUR NAME</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 16))}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="ENGINEER"
                  maxLength={16}
                  autoFocus
                  className="mt-1 w-full border border-line bg-void px-3 py-3 font-mono text-lg tracking-[0.15em] text-fg placeholder:text-dim focus:border-accent"
                />
              </label>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="brackets panel panel-accent flex items-center justify-center gap-2 px-6 py-3 font-mono text-sm font-bold tracking-[0.2em] text-accent disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                SUBMIT SCORE
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-4">
            {shareUrl && (
              <div className="text-right">
                <p className="tlabel">RESULT LINK</p>
                <button
                  onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => undefined)}
                  className="mt-1 flex items-center gap-2 font-mono text-xs text-accent hover:underline"
                  title="Copy result link"
                >
                  /results/{shareId} <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}
            {qr && <img src={qr} alt="QR code linking to this result" className="h-24 w-24 rounded-sm border border-line" />}
          </div>
        </div>
        {(error || offline) && (
          <p className="mt-3 text-sm text-amber">{offline ? "STALL OFFLINE — result computed locally, not ranked." : error}</p>
        )}
        {submitted && rank && (
          <p className="tlabel mt-3 text-good">BOARD UPDATED — CHECK THE BIG SCREEN</p>
        )}
      </motion.section>

      {/* Actions */}
      {!locked && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={onRestart}
            className="brackets panel panel-accent flex items-center gap-3 px-8 py-4 font-mono text-sm font-bold tracking-[0.25em] text-accent"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> RUN IT BACK
          </button>
          {onMenu && (
            <button onClick={onMenu} className="panel px-6 py-4 font-mono text-sm tracking-[0.2em] text-muted hover:text-fg">
              CHANGE MISSION
            </button>
          )}
          <Link href="/leaderboard" className="panel px-6 py-4 font-mono text-sm tracking-[0.2em] text-muted hover:text-fg">
            VIEW LEADERBOARD
          </Link>
        </div>
      )}
    </div>
  );
}
