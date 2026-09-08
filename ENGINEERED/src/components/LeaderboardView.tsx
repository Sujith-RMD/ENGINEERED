"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ALL_MISSIONS } from "@/data/missions";

interface Entry {
  id: string;
  missionId: string;
  difficulty: string;
  playerName: string | null;
  score: number;
  result?: { archetypeId: string };
}

const ARCHETYPE_SHORT: Record<string, string> = {
  systemsEngineer: "SYSTEMS",
  sustainabilityEngineer: "SUSTAIN",
  crisisEngineer: "CRISIS",
  resourceEngineer: "RESOURCE",
  innovator: "INNOVATOR",
  resilienceEngineer: "RESILIENCE",
  urbanist: "URBANIST",
  optimizer: "OPTIMIZER",
  socialEngineer: "SOCIAL",
  chaosEngineer: "CHAOS",
};

export function LeaderboardView() {
  const [scope, setScope] = useState<"today" | "all">("today");
  const [missionId, setMissionId] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ scope: missionId ? "mission" : scope, limit: "50" });
    if (missionId) params.set("missionId", missionId);
    fetch(`/api/leaderboard?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((data: { entries: Entry[] }) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, missionId]);

  const medal = (i: number) => (i === 0 ? "01" : i === 1 ? "02" : i === 2 ? "03" : String(i + 1).padStart(2, "0"));

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="tlabel">// STANDINGS</p>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-[0.15em]">
            🏆 ENGINEERS {scope === "today" ? "TODAY" : "ALL-TIME"}
          </h1>
        </div>
        <Link href="/" className="tlabel flex items-center gap-2 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> HOME
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setScope("today"); setMissionId(""); }}
          className={`border px-4 py-2 font-mono text-xs tracking-[0.15em] ${!missionId && scope === "today" ? "border-accent text-accent" : "border-line text-muted"}`}
        >
          TODAY
        </button>
        <button
          onClick={() => { setScope("all"); setMissionId(""); }}
          className={`border px-4 py-2 font-mono text-xs tracking-[0.15em] ${!missionId && scope === "all" ? "border-accent text-accent" : "border-line text-muted"}`}
        >
          ALL-TIME
        </button>
        <span className="mx-2 h-4 w-px bg-line" aria-hidden />
        <select
          value={missionId}
          onChange={(e) => setMissionId(e.target.value)}
          aria-label="Filter by mission"
          className="border border-line bg-panel px-3 py-2 font-mono text-xs text-muted"
        >
          <option value="">ALL MISSIONS</option>
          {ALL_MISSIONS.map((m) => (
            <option key={m.id} value={m.id}>{m.icon} {m.title}</option>
          ))}
        </select>
      </div>

      {loading && <p className="tlabel animate-pulse-soft">LOADING STANDINGS…</p>}
      {failed && (
        <p className="panel border-amber/50 p-5 text-sm text-amber">
          Leaderboard service unreachable. Runs still count locally — the board will catch up when the link returns.
        </p>
      )}
      {!loading && !failed && entries.length === 0 && (
        <p className="panel p-8 text-center text-muted">
          No entries yet. <Link href="/play" className="text-accent hover:underline">Be the first engineer on the board.</Link>
        </p>
      )}

      <ol className="space-y-2">
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={`panel flex items-center gap-4 px-5 py-3 ${i < 3 ? "panel-accent" : ""}`}
          >
            <span className={`font-mono text-xl font-bold tabular-nums ${i < 3 ? "text-accent" : "text-dim"}`}>
              {medal(i)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-base font-bold tracking-[0.1em]">
                {e.playerName ?? "ANONYMOUS ENGINEER"}
              </p>
              <p className="tlabel">
                {ALL_MISSIONS.find((m) => m.id === e.missionId)?.title ?? e.missionId} · {e.difficulty.toUpperCase()}
                {e.result?.archetypeId ? ` · ${ARCHETYPE_SHORT[e.result.archetypeId] ?? ""}` : ""}
              </p>
            </div>
            <span className="font-mono text-2xl font-bold tabular-nums text-fg">{e.score}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
