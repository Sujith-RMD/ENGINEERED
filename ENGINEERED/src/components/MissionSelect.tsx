"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { missionCards, type MissionCardData } from "@/lib/client/missions";
import { DIFFICULTIES } from "@/types/game";

const DIFFICULTY_INFO: Record<string, { label: string; hint: string; mod: string }> = {
  easy: { label: "EASY", hint: "Forgiving system. Learn the controls.", mod: "×0.90 score" },
  normal: { label: "NORMAL", hint: "The intended stall experience.", mod: "×1.00 score" },
  hard: { label: "HARD", hint: "Sharper cascades, tighter budget.", mod: "×1.08 score" },
  nightmare: { label: "NIGHTMARE", hint: "Severe constraints. Deeper thinking.", mod: "×1.15 score" },
};

function DifficultyPips({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Difficulty ${level} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-4 ${i < level ? "bg-accent" : "bg-line"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function MissionSelect() {
  const cards = useMemo(() => missionCards(), []);
  const router = useRouter();
  const [selected, setSelected] = useState<MissionCardData | null>(null);
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    if (!selected) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: selected.id, difficulty }),
      });
      if (res.ok) {
        const data = (await res.json()) as { sessionId: string; seed: number };
        sessionStorage.setItem(
          "eng.session",
          JSON.stringify({ sessionId: data.sessionId, seed: data.seed, difficulty, offline: false })
        );
      } else {
        // Offline mode: play locally; leaderboard submission will degrade gracefully.
        const seed = Math.floor(Math.random() * 2 ** 31);
        sessionStorage.setItem(
          "eng.session",
          JSON.stringify({ sessionId: `local-${seed}`, seed, difficulty, offline: true })
        );
      }
      sessionStorage.setItem("eng.difficulty", difficulty);
      router.push(`/play/${selected.id}`);
    } catch {
      const seed = Math.floor(Math.random() * 2 ** 31);
      sessionStorage.setItem(
        "eng.session",
        JSON.stringify({ sessionId: `local-${seed}`, seed, difficulty, offline: true })
      );
      sessionStorage.setItem("eng.difficulty", difficulty);
      router.push(`/play/${selected.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="tlabel">// MISSION SELECT</p>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-[0.15em]">CHOOSE YOUR SYSTEM</h1>
        </div>
        <Link href="/" className="tlabel flex items-center gap-2 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> HOME
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, i) => {
          const active = selected?.id === card.id;
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              onClick={() => {
                setSelected(card);
                setError(null);
              }}
              aria-pressed={active}
              className={`panel brackets text-left transition-all duration-200 hover:-translate-y-1 ${
                active ? "panel-accent" : ""
              }`}
            >
              <div className="flex items-start justify-between p-5 pb-3">
                <span className="text-4xl" aria-hidden>{card.icon}</span>
                <DifficultyPips level={card.difficulty} />
              </div>
              <div className="px-5 pb-5">
                <h2 className="font-mono text-lg font-bold tracking-[0.12em] text-fg">{card.title}</h2>
                <p className="mt-1 text-sm text-muted">{card.tagline}</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {card.startSnapshot.map((s) => (
                    <div key={s.label} className="rounded-sm border border-line bg-void/60 px-2 py-1.5 text-center">
                      <div className="text-sm" aria-hidden>{s.icon}</div>
                      <div className="font-mono text-sm font-bold text-fg">{s.value}</div>
                      <div className="tlabel text-[8px]">{s.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-dim">{card.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {selected && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel panel-accent brackets sticky bottom-4 mt-8 p-6"
          aria-label="Difficulty selection"
        >
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl" aria-hidden>{selected.icon}</span>
              <div>
                <h2 className="font-mono text-xl font-bold tracking-[0.15em]">{selected.title}</h2>
                <p className="mt-1 max-w-md text-sm text-muted">
                  <span className="tlabel mr-2">OBJECTIVE</span>
                  {selected.primaryObjective}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => {
                const info = DIFFICULTY_INFO[d];
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    title={info.hint}
                    aria-pressed={active}
                    className={`border px-4 py-3 text-left transition-colors ${
                      active ? "border-accent bg-accent/10" : "border-line bg-void/50 hover:border-line2"
                    }`}
                  >
                    <div className={`font-mono text-xs font-bold tracking-[0.18em] ${active ? "text-accent" : "text-muted"}`}>
                      {info.label}
                    </div>
                    <div className="tlabel mt-1 text-[9px]">{info.mod}</div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={begin}
              disabled={starting}
              className="brackets panel panel-accent flex items-center gap-3 px-8 py-4 font-mono text-sm font-bold tracking-[0.25em] text-accent disabled:opacity-60"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              INITIALIZE SYSTEM
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </motion.section>
      )}
    </main>
  );
}
