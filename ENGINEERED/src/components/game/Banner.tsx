"use client";

import { AnimatePresence, motion } from "motion/react";

export interface BannerData {
  id: number;
  text: string;
  tone: "info" | "warn" | "danger" | "good";
}

const TONE_CLASS: Record<BannerData["tone"], string> = {
  info: "border-accent/70 text-accent",
  warn: "border-amber text-amber",
  danger: "border-danger text-danger",
  good: "border-good text-good",
};

/** ENGINEERED moments: cinematic center-screen callouts. */
export function Banner({ banner }: { banner: BannerData | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center" aria-live="assertive">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28 }}
            className={`brackets panel border bg-void/95 px-8 py-4 font-mono text-lg font-bold tracking-[0.25em] ${TONE_CLASS[banner.tone]}`}
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
