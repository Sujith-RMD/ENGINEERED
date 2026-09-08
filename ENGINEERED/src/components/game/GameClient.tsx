"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { RunEngine } from "@/lib/simulation/engine";
import { replayRun } from "@/lib/server/replay";
import { DIFFICULTY_TUNING } from "@/lib/simulation/engine";
import type { Difficulty, Effect, MissionDef, RunResult } from "@/types/game";
import { HUD } from "./HUD";
import { MetricsGrid } from "./MetricsGrid";
import { ActionTile } from "./ActionTile";
import { EventPanel } from "./EventPanel";
import { Feed } from "./Feed";
import { Banner, type BannerData } from "./Banner";
import { BriefingGate } from "./BriefingGate";
import { ResultView, type DisplayResult } from "@/components/results/ResultView";

type Phase = "briefing" | "live" | "projecting" | "results";

interface SessionInfo {
  sessionId: string;
  seed: number;
  difficulty: Difficulty;
  offline: boolean;
}

const START_YEAR = 2036;

export function GameClient({ mission }: { mission: MissionDef }) {
  const router = useRouter();
  const engineRef = useRef<RunEngine | null>(null);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const flagsRef = useRef({ t30: false, t10: false, failWarn: false });
  const prevActiveEventRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("briefing");
  const [, setTick] = useState(0);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [offline, setOffline] = useState(false);
  const [year, setYear] = useState(START_YEAR);
  const [display, setDisplay] = useState<DisplayResult | null>(null);
  const [rank, setRank] = useState<{ today: number; mission: number } | undefined>();
  const [shareId, setShareId] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load session prepared by the mission select screen.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("eng.session");
      if (raw) {
        const info = JSON.parse(raw) as SessionInfo;
        setDifficulty(info.difficulty);
        setOffline(info.offline);
        return;
      }
    } catch {
      // fall through to defaults
    }
    const seed = Math.floor(Math.random() * 2 ** 31);
    sessionStorage.setItem(
      "eng.session",
      JSON.stringify({ sessionId: `local-${seed}`, seed, difficulty: "normal", offline: true })
    );
    setOffline(true);
  }, []);

  const showBanner = useCallback((text: string, tone: BannerData["tone"]) => {
    setBanner({ id: Date.now(), text, tone });
    window.setTimeout(() => setBanner((b) => (b && b.text === text ? null : b)), 2200);
  }, []);

  const startRun = useCallback(() => {
    let info: SessionInfo = { sessionId: "", seed: 0, difficulty: "normal", offline: true };
    try {
      const raw = sessionStorage.getItem("eng.session");
      if (raw) info = JSON.parse(raw) as SessionInfo;
    } catch {
      const seed = Math.floor(Math.random() * 2 ** 31);
      info = { sessionId: `local-${seed}`, seed, difficulty: "normal", offline: true };
    }
    engineRef.current = new RunEngine(mission, info.seed, { difficulty: info.difficulty });
    startedAtRef.current = performance.now();
    finishedRef.current = false;
    flagsRef.current = { t30: false, t10: false, failWarn: false };
    prevActiveEventRef.current = null;
    setDifficulty(info.difficulty);
    setOffline(info.offline);
    setPhase("live");
  }, [mission]);

  const actionsOf = useCallback((engine: RunEngine) => {
    return engine.state.taken.map((t) => ({ actionId: t.actionId, t: t.t, eventId: t.eventId }));
  }, []);

  const computeLocalResult = useCallback((): DisplayResult | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    const replay = replayRun(mission.id, difficulty, engine.state.seed, actionsOf(engine));
    if (!replay.ok) return null;
    const result: RunResult = replay.result;
    return {
      missionId: result.missionId,
      difficulty: result.difficulty,
      score: result.score,
      archetype: result.archetype,
      projection: result.projection,
      finalState: result.finalState,
      achievement: result.achievement,
      mistake: result.mistake,
    };
  }, [mission.id, difficulty, actionsOf]);

  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const engine = engineRef.current;
    if (!engine) return;
    engine.processUntil(150);
    engine.endRun();
    setPhase("projecting");
    // Cinematic decade roll, then the reveal.
    const years = [2038, 2040, 2042, 2044, 2046];
    years.forEach((y, i) => window.setTimeout(() => setYear(y), 400 + i * 420));
    window.setTimeout(() => {
      const local = computeLocalResult();
      if (local) {
        setDisplay(local);
        sessionStorage.setItem("eng.result", JSON.stringify(local));
      }
      setYear(2046);
      setPhase("results");
    }, 2900);
  }, [computeLocalResult]);

  // The clock. 200 ms wall-clock driver; the engine advances in whole seconds.
  useEffect(() => {
    if (phase !== "live") return;
    const id = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      engine.processUntil(Math.min(150, Math.floor(elapsed)));
      const st = engine.state;

      // --- ENGINEERED moments
      const remaining = 150 - st.elapsed;
      if (!flagsRef.current.t30 && remaining <= 30) {
        flagsRef.current.t30 = true;
        showBanner("30 SECONDS REMAINING", "warn");
      }
      if (!flagsRef.current.t10 && remaining <= 10) {
        flagsRef.current.t10 = true;
        showBanner("FINAL SECONDS — COMMIT", "danger");
      }
      const fc = mission.failureConditions[0];
      if (fc && !flagsRef.current.failWarn) {
        const value = st.metrics[fc.metric] ?? 100;
        if (value < fc.below + 10) {
          flagsRef.current.failWarn = true;
          showBanner("⚠ SYSTEM FAILURE IMMINENT", "danger");
        }
      }
      const activeId = st.activeEvent?.eventId ?? null;
      if (activeId && prevActiveEventRef.current === null) {
        const ev = mission.events.find((e) => e.id === activeId);
        showBanner(`${ev?.icon ?? "⚠"} ${ev?.title ?? "CRISIS"} — RESPOND`, "danger");
      }
      prevActiveEventRef.current = activeId;

      if (st.status !== "running" || st.elapsed >= 150) {
        finishRun();
        return;
      }
      setTick((t) => t + 1);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, mission, showBanner, finishRun]);

  // ---------------------------------------------------------------- handlers

  const takeAction = useCallback((actionId: string) => {
    const engine = engineRef.current;
    if (!engine || engine.state.status !== "running") return;
    engine.takeAction(actionId);
    setTick((t) => t + 1);
  }, []);

  const respond = useCallback((actionId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const ok = engine.respondToEvent(actionId);
    if (ok) showBanner("CRISIS CONTAINED", "good");
    setTick((t) => t + 1);
  }, [showBanner]);

  const submitScore = useCallback(async (playerName: string): Promise<{ shareId?: string; rank?: { today: number; mission: number }; error?: string; offline?: boolean }> => {
    const engine = engineRef.current;
    if (!engine) return { error: "No run to submit" };
    try {
      const raw = sessionStorage.getItem("eng.session");
      const info: SessionInfo = raw ? JSON.parse(raw) : { sessionId: "", seed: 0, difficulty, offline: true };
      if (info.offline || !info.sessionId || info.sessionId.startsWith("local-")) {
        return { offline: true, error: "Leaderboard offline — result not ranked" };
      }
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: info.sessionId, playerName, actions: actionsOf(engine) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return { error: body.error ?? `Submission failed (${res.status})` };
      }
      const data = (await res.json()) as { shareId: string; rank: { today: number; mission: number } };
      setShareId(data.shareId);
      setRank(data.rank);
      return { shareId: data.shareId, rank: data.rank };
    } catch {
      return { error: "Network unreachable — result not ranked" };
    }
  }, [actionsOf, difficulty]);

  const restart = useCallback(() => {
    setDisplay(null);
    setRank(undefined);
    setShareId(undefined);
    setSubmitError(null);
    setYear(START_YEAR);
    setPhase("briefing");
  }, []);

  // ---------------------------------------------------------------- derived

  const engine = engineRef.current;
  const state = engine?.state;
  const remaining = state ? Math.max(0, 150 - state.elapsed) : 150;
  const recentDeltas: Record<string, Effect[]> = {};
  if (state) {
    for (let i = state.log.length - 1; i >= 0 && i >= state.log.length - 6; i--) {
      const entry = state.log[i]!;
      if (!entry.deltas) continue;
      for (const d of entry.deltas) {
        (recentDeltas[d.metric] ??= []).push(d);
      }
    }
  }

  const available = engine ? engine.availableActions() : [];
  const standard = available.filter((a) => a.action.scope === "standard");
  const endgame = available.filter((a) => a.action.scope === "endgame");
  const activeEvent = state?.activeEvent
    ? mission.events.find((e) => e.id === state.activeEvent!.eventId)
    : undefined;
  const responseOptions = engine ? engine.eventResponseOptions() : [];

  // ---------------------------------------------------------------- render

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-4 pb-10">
      <Banner banner={banner} />

      <AnimatePresence>
        {phase === "briefing" && (
          <BriefingGate mission={mission} difficulty={difficulty} onStart={startRun} />
        )}
      </AnimatePresence>

      {phase === "projecting" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-void/97">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tlabel text-accent">
            ENGINEERING COMPLETE
          </motion.p>
          <motion.h2
            key={year}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 font-mono text-6xl font-bold tracking-[0.2em] text-fg"
          >
            {year}
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="tlabel mt-6">
            SIMULATING THE NEXT 10 YEARS…
          </motion.p>
          <div className="mt-8 h-[2px] w-64 overflow-hidden bg-line">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              className="h-full w-1/2 bg-accent"
            />
          </div>
        </div>
      )}

      {phase === "live" && state && engine && (
        <>
          <HUD mission={mission} state={state} remaining={remaining} offline={offline} />

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <MetricsGrid mission={mission} state={state} recentDeltas={recentDeltas} />

              {activeEvent && state.activeEvent ? (
                <EventPanel event={activeEvent} state={state} options={responseOptions} onRespond={respond} />
              ) : (
                <section aria-label="Engineering decisions">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="tlabel">// ENGINEERING DECISIONS — ACT NOW</p>
                    <p className="tlabel">{state.taken.length} ACTIONS LOGGED</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
                    {standard.map(({ action, reasons }) => (
                      <ActionTile
                        key={action.id}
                        action={action}
                        disabled={reasons.length > 0}
                        reason={reasons[0]}
                        onClick={() => takeAction(action.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section aria-label="Final decision">
                <div className="mb-2 flex items-center justify-between">
                  <p className="tlabel text-amber">// FINAL DECISION — UNLOCKS AT 0:30</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {endgame.map(({ action, reasons }) => (
                    <ActionTile
                      key={action.id}
                      action={action}
                      disabled={reasons.length > 0}
                      reason={reasons[0]}
                      highlight={reasons.length === 0 ? "endgame" : undefined}
                      onClick={() => takeAction(action.id)}
                    />
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <Feed log={state.log} />
              <div className="panel p-3">
                <p className="tlabel mb-2">// RUN INTEL</p>
                <dl className="space-y-1.5 font-mono text-xs text-muted">
                  <div className="flex justify-between"><dt>DIFFICULTY</dt><dd className="text-fg">{DIFFICULTY_TUNING[difficulty].label}</dd></div>
                  <div className="flex justify-between"><dt>DECISIONS</dt><dd className="text-fg">{state.taken.length}</dd></div>
                  <div className="flex justify-between"><dt>CRISES FACED</dt><dd className="text-fg">{state.firedEvents.length}</dd></div>
                  <div className="flex justify-between"><dt>SEED</dt><dd className="text-dim">#{state.seed % 100000}</dd></div>
                </dl>
              </div>
              <div className="panel p-3">
                <p className="tlabel mb-2">// STALL LINKS</p>
                <div className="flex flex-col gap-2 font-mono text-xs">
                  <Link href="/leaderboard" className="text-accent hover:underline">▸ LIVE LEADERBOARD</Link>
                  <Link href="/play" className="text-muted hover:text-fg">▸ ABANDON & CHANGE MISSION</Link>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {phase === "results" && display && (
        <ResultView
          result={display}
          missionTitle={mission.title}
          missionIcon={mission.icon}
          rank={rank}
          shareId={shareId}
          offline={offline}
          submitError={submitError}
          onSubmitName={async (name) => {
            const out = await submitScore(name);
            setSubmitError(out.error ?? null);
            return out;
          }}
          onRestart={restart}
          onMenu={() => router.push("/play")}
        />
      )}
    </main>
  );
}
