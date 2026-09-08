# ENGINEERED

**150 SECONDS. ONE SYSTEM. INFINITE CONSEQUENCES.**

A consequence-driven engineering simulation built for Engineers' Day. Take command of a failing
system — a grid, a river, a wildfire line, a Mars habitat — make trade-offs under a ticking clock,
survive exactly one crisis, and then watch the **10-year projection** your decisions created.

Not a quiz. Every run is a live deterministic simulation; every score is earned, verified, and
recorded.

---

## The pitch (10 seconds)

- **150 seconds** on the clock. The system degrades every second you watch it.
- You have a **budget (₹ Cr)** and **political capital**. Everything else is a trade-off.
- **One major crisis** will hit mid-run — you'll have ~15 seconds to choose a response.
- At **0:30** the **Final Decision** unlocks: one irreversible commitment for the decade.
- When the clock dies, the simulation projects **10 years forward** and scores you on outcomes,
  8 engineering skills, and your crisis response. Your archetype is assigned by *how you played*.

## Quick start

```bash
npm install          # (in restricted environments: npm install --ignore-scripts)
npm run build        # prisma generate + next build
npm run stall        # one command: postgres + schema + server on :3000
```

Or piece by piece:

```bash
npm run dev          # dev server
npm run test         # vitest suite (24 tests: engine, scoring, mission validation)
npm run typecheck    # tsc --noEmit
```

Environment (`.env`):

```
DATABASE_URL="postgresql://engineered:engineered@localhost:55432/engineered"
ADMIN_PASSCODE="ENGINEER-2046"
```

### Stall operations (organizer)

| Task | How |
|---|---|
| Launch everything | `npm run stall` (embedded PG on :55432 + Next on :3000) |
| Organizer console | `/admin` — passcode from `ADMIN_PASSCODE` |
| Live monitor | `/admin` shows active sessions, recent results, today's top 10 |
| Hide a bad entry | one click (eye icon) in the console |
| Reset the board | **Clear today's leaderboard** button, or `node scripts/reset-leaderboard.mjs --all` |
| Disable missions | toggle any mission on/off from `/admin` |
| Offline resilience | gameplay never needs the network. If the DB is down the game plays locally and results show "not ranked" instead of failing |

---

## Architecture

```
src/
├── types/game.ts                 # The contract: variables, actions, events, missions, results
├── data/missions/                # 10 mission definitions (pure data files)
├── lib/simulation/               # THE ENGINE — pure TypeScript, zero React/Next/DB imports
│   ├── variables.ts              #   variable registry + tuning constants
│   ├── rng.ts                    #   mulberry32 seeded RNG
│   ├── relationships.ts          #   cross-metric consequence waves
│   ├── engine.ts                 #   RunEngine: integer-second pipeline
│   └── projection.ts             #   deterministic 10-year projection
├── lib/scoring/                  # outcome + 8 skills + archetypes + insights (pure)
├── lib/missions/validate.ts      # structural validation (runs in CI/test)
├── lib/server/                   # replay, rate limiting, admin auth, settings
├── lib/database/                 # Prisma client
├── app/api/                      # sessions, results, leaderboard, admin routes
└── components/                   # game UI (React 19 + Motion, Lucide icons)
```

### The engine never trusts React, and the server never trusts the client

1. **Deterministic simulation.** `RunEngine(mission, seed, {difficulty})` replays a run from
   a decision list. Same (mission, seed, decisions) ⇒ bit-identical run, forever.
2. **Server-authoritative scoring.** The client submits only `{sessionId, playerName, actions[]}`.
   The server re-simulates the entire run from the stored seed, computes the score itself, and
   writes the result. Client scores are never read.
3. **Consequences ripple.** Direct effects apply immediately; related metrics receive damped
   waves (0.5× per hop, max 3 hops). Building a highway *does* reach the lungs.
4. **Exactly one major crisis per run**, drawn by weighted, state-modulated RNG in a scheduled
   window. Ambient events fire on thresholds you create by neglecting the system.
5. **Skill scoring is behavioral.** 8 skill categories (systems thinking, innovation, resource
   efficiency, sustainability, social impact, resilience, crisis response, long-term planning)
   are inferred from *what you did and when* — never random. The archetype (10 possibilities)
   is assigned from the same signals. Same play, same archetype.

### The integer-second pipeline

Every simulated second: variable drift → delayed effects landing → scheduled major event →
ambient threshold checks (every 5 s) → response-window expiry (unresponded crises take the
harsher penalty) → failure conditions. The UI drives the engine with wall-clock time; the
server replays with the mission clock.

## Missions

| Mission | System | Identity | Difficulty |
|---|---|---|---|
| 🚦 City Gridlock | traffic | induced demand: roads work, then betray you | ★★ |
| 🌊 Floodline | flood | the water is a living system; shortcuts flood someone else | ★★ |
| 💧 Last Drop | water | demand-side is cheap and hated; supply-side is loved and late | ★★★ |
| ⚡ Blackout | grid | the merit-order trap: peakers tonight, carbon for decades | ★★★ |
| 🗑️ Zero Waste | waste | the landfill clock vs. the circular economy | ★★ |
| 🏥 Code Critical | health | fix the queue or fix the pipeline | ★★★★ |
| 🎓 Campus 2040 | campus | the gentlest on-ramp; the rankings trap is real | ★ |
| 🌆 City 2040 | master plan | everything is connected and nothing is free | ★★★★★ |
| 🔥 Fireline | wildfire | suppression is theatre; fuel management is destiny | ★★★★ |
| 🚀 Mars Habitat | life support | every resource is a loop; nothing is wasted in space | ★★★★★ |

Every mission is a data file satisfying `MissionDef` — validated at test time (weights sum
90–110, every crisis response wired, endgame dilemma pair mutually exclusive, no free lunches,
start state in crisis territory). Adding a mission never touches the engine.

## Scoring

```
overall = 0.55 × outcome + 0.35 × mean(skills) + 0.10 × crisisResponse
outcome  = mission-weighted 10-year projection delta (0–100)
skills   = 8 behavioral categories (0–100)
crisisResponse = absorption + response speed + coverage
× difficulty modifier: easy 0.90 · normal 1.00 · hard 1.08 · nightmare 1.15
```

## API

| Route | Purpose |
|---|---|
| `POST /api/sessions` | start a run → `{sessionId, seed}` (checks mission enabled; 30/min) |
| `POST /api/results` | submit `{sessionId, playerName, actions[]}` → server re-simulates → `{score, archetype, projection, rank, shareId}` (12/min; 409 on resubmit; 400 on unknown actions) |
| `GET /api/leaderboard?scope=today\|all\|mission&missionId=` | top 50, hidden entries excluded |
| `GET /api/results/[shareId]` | JSON for a shared result |
| `POST/DELETE /api/admin/login` | passcode → httpOnly cookie |
| `GET /api/admin/overview` | live sessions, recent results, today's top 10, mission states |
| `POST /api/admin/missions` | enable/disable missions |
| `POST /api/admin/moderate` | `{op: hide\|clearDay\|purgeStale}` |

## Testing

```bash
npm run test
```

24 tests cover: determinism (same seed + decisions ⇒ identical run), metric bounds,
affordability/conflicts/cooldowns/max-uses, synergy firing (both directions), one-major-per-run,
event windows, unresponded-penalty severity, preparation mediating damage, projection bounds,
score bounds, difficulty determinism, archetype stability, crisis-response signals, full-run
integrity across all 10 missions, and structural validation of every mission with zero errors.

## Production notes (restricted environments)

This project was built and verified inside a sandbox that blocks all child-process spawning
from Node. If you deploy in a normal environment, ignore this section. Inside such a sandbox:

- `next build` runs with `--experimental-build-mode=compile` and
  `experimental.workerThreads: true` (see `next.config.ts`) so no build workers spawn.
  Type safety is enforced separately: `npm run typecheck` (clean).
- The database runs as the bundled PostgreSQL binaries (`@embedded-postgres/windows-x64`)
  started directly: `initdb` once, then `postgres -D db -p 55432`.
- Schema is applied with `node scripts/apply-schema.mjs` (plain DDL over a socket — no Prisma
  schema-engine spawn). It mirrors `prisma/schema.prisma` exactly.
- Smoke test: `node scripts/smoke-test.mjs` — 23 end-to-end checks (session → verified score →
  leaderboard → share page → admin flow).

On an unrestricted machine, `npm run build && npm run start` and `prisma db push` all work as
standard.

## Design invariants

- The simulation engine imports nothing from React, Next, or the database. Ever.
- Scores are computed server-side from the stored seed. The client's local score is display only.
- Every action prints its trade-off on the tile. The trap is printed, never hidden.
- One major crisis per run — chosen by weighted draw, never repeated.
- The endgame choice is irreversible and defines the decade.
- Leaderboards start empty and honest; the organizer can hide or clear anything.

---

*Built for the SDG Club, Engineers' Day. Every decision echoes for a decade.*
