import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/database/db";
import { getMission } from "@/data/missions";
import { ARCHETYPES } from "@/lib/scoring/archetypes";
import type { ArchetypeId, ScoreResult } from "@/types/game";

async function getResult(shareId: string) {
  try {
    return await prisma.result.findUnique({ where: { shareId } });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const { shareId } = await params;
  const result = await getResult(shareId);
  if (!result) return { title: "Result not found — ENGINEERED" };
  const mission = getMission(result.missionId);
  return {
    title: `${result.playerName ?? "An engineer"} scored ${result.score} — ENGINEERED`,
    description: `${mission?.title ?? result.missionId} · ${ARCHETYPES[result.archetypeId as ArchetypeId]?.name ?? "Engineer"}`,
  };
}

export default async function SharedResultPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const result = await getResult(shareId);
  if (!result) notFound();
  const mission = getMission(result.missionId);
  const archetype = ARCHETYPES[result.archetypeId as ArchetypeId];
  const metrics = result.metrics as unknown as ScoreResult | undefined;
  const projection = result.projection as unknown as { deltas?: { metric: string; label: string; icon: string; change: number; higherIsBetter: boolean }[]; storyBeats?: string[] } | undefined;
  const summary = result.summary as unknown as { achievement?: { title: string; text: string }; mistake?: { title: string; text: string } } | undefined;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <p className="tlabel">// SHARED RESULT — {result.shareId}</p>
      <h1 className="mt-2 font-mono text-3xl font-bold tracking-[0.12em]">
        <span className="mr-2" aria-hidden>{mission?.icon}</span>
        {result.playerName ?? "ANONYMOUS ENGINEER"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mission?.title ?? result.missionId} · {result.difficulty.toUpperCase()} ·{" "}
        {new Date(result.createdAt).toLocaleDateString()}
      </p>

      <section className="panel panel-accent brackets mt-6 p-6 text-center">
        <p className="tlabel">ENGINEER SCORE</p>
        <p className="mt-2 font-mono text-7xl font-bold text-accent">{result.score}</p>
        {archetype && (
          <>
            <p className="mt-3 font-mono text-xl font-bold tracking-[0.1em]">{archetype.name}</p>
            <p className="mt-1 text-sm italic text-muted">“{archetype.title}”</p>
          </>
        )}
      </section>

      {projection?.deltas && projection.deltas.length > 0 && (
        <section className="panel mt-5 p-5">
          <p className="tlabel mb-3">// SYSTEM — 2046</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {projection.deltas.map((d) => {
              const improving = d.higherIsBetter ? d.change > 0 : d.change < 0;
              return (
                <div key={d.metric} className="rounded-sm border border-line bg-void/60 p-2 text-center">
                  <span aria-hidden>{d.icon}</span>
                  <p className={`font-mono text-lg font-bold ${improving ? "text-good" : "text-danger"}`}>
                    {d.change > 0 ? "▲" : "▼"} {Math.abs(d.change).toFixed(0)}%
                  </p>
                  <p className="tlabel truncate text-[8px]">{d.label}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(summary?.achievement || summary?.mistake) && (
        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {summary.achievement && (
            <div className="panel border-good/40 p-4">
              <p className="tlabel text-good">BIGGEST ACHIEVEMENT</p>
              <p className="mt-1 font-mono font-bold">{summary.achievement.title}</p>
              <p className="mt-1 text-sm text-muted">{summary.achievement.text}</p>
            </div>
          )}
          {summary.mistake && (
            <div className="panel border-danger/40 p-4">
              <p className="tlabel text-danger">BIGGEST MISTAKE</p>
              <p className="mt-1 font-mono font-bold">{summary.mistake.title}</p>
              <p className="mt-1 text-sm text-muted">{summary.mistake.text}</p>
            </div>
          )}
        </section>
      )}

      {metrics && (
        <section className="panel mt-5 p-5">
          <p className="tlabel mb-3">// SKILL PROFILE</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(metrics.skills ?? {}).map(([key, value]) => (
              <div key={key}>
                <div className="meter h-1.5">
                  <div className="meter-fill bg-accent" style={{ width: `${value}%` }} />
                </div>
                <p className="tlabel mt-1 truncate text-[8px]">{key.replace(/([A-Z])/g, " $1").toUpperCase()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-4">
        <Link href="/play" className="brackets panel panel-accent px-6 py-3 font-mono text-sm font-bold tracking-[0.2em] text-accent">
          BEAT THIS SCORE ▸
        </Link>
        <Link href="/leaderboard" className="panel px-6 py-3 font-mono text-sm tracking-[0.2em] text-muted hover:text-fg">
          LEADERBOARD
        </Link>
      </div>
    </main>
  );
}
