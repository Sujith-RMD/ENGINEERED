"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, Trophy } from "lucide-react";

const lines = ["150 SECONDS.", "ONE SYSTEM.", "INFINITE CONSEQUENCES."];

export function Hero() {
  return (
    <section className="flex min-h-[92vh] flex-col items-center justify-center px-6 text-center">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="tlabel mb-6"
      >
        // ENGINEERS&apos; DAY — LIVE SIMULATION
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="font-mono text-6xl font-bold tracking-[0.18em] text-fg sm:text-7xl md:text-8xl"
        style={{ textShadow: "0 0 42px rgba(34,211,238,0.25)" }}
      >
        ENGINEERED
      </motion.h1>

      <div className="mt-8 space-y-1">
        {lines.map((line, i) => (
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 + i * 0.18, duration: 0.55 }}
            className="font-mono text-xl tracking-[0.3em] text-muted sm:text-2xl"
          >
            {line}
          </motion.p>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.35, duration: 0.6 }}
        className="mt-10 max-w-xl text-base text-muted sm:text-lg"
      >
        Can you engineer a future that survives your decisions?
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.6 }}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
      >
        <Link
          href="/play"
          className="group brackets panel panel-accent flex items-center gap-3 px-8 py-4 font-mono text-sm font-bold tracking-[0.25em] text-accent transition-transform duration-200 hover:-translate-y-0.5"
        >
          START ENGINEERING
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
        <Link
          href="/leaderboard"
          className="panel flex items-center gap-3 px-6 py-4 font-mono text-sm tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          <Trophy className="h-4 w-4" aria-hidden />
          VIEW LEADERBOARD
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="tlabel mt-16 flex gap-8"
      >
        <span>10 MISSIONS</span>
        <span className="text-accent">150 SECONDS</span>
        <span>8 SKILLS SCORED</span>
        <span>10-YEAR PROJECTION</span>
      </motion.div>
    </section>
  );
}
