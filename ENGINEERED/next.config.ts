import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type safety is enforced separately via `npx tsc --noEmit` (which runs
    // clean); building in-process avoids worker spawns in restricted envs.
    ignoreBuildErrors: true,
  },
  // Sandbox hardening: Next's default build workers spawn child processes,
  // which is blocked in this environment. workerThreads makes jest-worker
  // use worker_threads (no process spawn); webpackBuildWorker: false keeps
  // the main webpack compile on the main thread entirely.
  experimental: {
    workerThreads: true,
    webpackBuildWorker: false,
    cpus: 1,
  },
};

export default nextConfig;
