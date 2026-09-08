"use client";

import { motion } from "motion/react";
import type { MissionDef } from "@/types/game";

export function BriefingGate({ mission, difficulty, onStart }: {
  mission: MissionDef;
  difficulty: string;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/95 px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="panel panel-accent brackets w-full max-w-3xl p-8"
      >
        <p className="tlabel">// MISSION BRIEFING — {difficulty.toUpperCase()}</p>
        <h1 className="mt-3 font-mono text-4xl font-bold tracking-[0.12em]">
          <span className="mr-3" aria-hidden>{mission.icon}</span>
          {mission.title}
        </h1>
        <p className="mt-2 text-muted">{mission.description}</p>

        <div className="mt-8 space-y-5">
          <div>
            <p className="tlabel text-amber">SITUATION</p>
            <p className="mt-1 text-lg leading-snug text-fg">{mission.briefing.situation}</p>
          </div>
          <div>
            <p className="tlabel text-accent">YOUR OBJECTIVE</p>
            <p className="mt-1 text-lg leading-snug text-fg">{mission.briefing.objective}</p>
          </div>
          <div>
            <p className="tlabel text-danger">WARNING</p>
            <p className="mt-1 text-lg leading-snug text-fg">{mission.briefing.warning}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-line pt-6">
          <div>
            <p className="tlabel">BUDGET</p>
            <p className="font-mono text-2xl font-bold text-fg">₹{mission.budget} Cr</p>
          </div>
          <div>
            <p className="tlabel">CLOCK</p>
            <p className="font-mono text-2xl font-bold text-accent">02:30</p>
          </div>
          <div>
            <p className="tlabel">PRIMARY OBJECTIVE</p>
            <p className="max-w-md text-sm text-muted">{mission.primaryObjective}</p>
          </div>
          <button
            onClick={onStart}
            className="brackets panel panel-accent ml-auto px-10 py-5 font-mono text-base font-bold tracking-[0.3em] text-accent transition-transform hover:-translate-y-0.5"
            autoFocus
          >
            INITIALIZE ▸
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
