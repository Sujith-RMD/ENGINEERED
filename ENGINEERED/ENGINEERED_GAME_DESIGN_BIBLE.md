# ENGINEERED — GAME DESIGN BIBLE

### 150 SECONDS. ONE SYSTEM. INFINITE CONSEQUENCES.

**Version 1.0 — Single Source of Truth**
Status: Design-locked for implementation. This document is authoritative; where any other note, sketch, or conversation conflicts with it, this document wins unless explicitly amended by a dated addendum at the end of this file.

---

## DOCUMENT MAP

| Part | Sections | What it covers |
|---|---|---|
| I | ES–5 | Executive summary, design pillars, target experience, core loop, the 150-second system |
| II | 6–9 | System variables, resource model, decision system, consequence engine |
| III | 10–12 | Event engine, mission architecture, the ten mission concepts |
| IV | 13–16 | 10-year projection, scoring model, archetypes, leaderboard |
| V | 17–20 | Result card, stall architecture, UX principles, visual identity |
| VI | 21–25 | Technical constraints, edge cases & fairness, balancing strategy, final principles, appendices |

**Naming conventions used throughout:** The player is the **Engineer**. The simulated subject is the **System** (a city, campus, colony, or grid). A playthrough is a **Run**. The person running the stall is the **Marshal**. Every numeric constant in this document is marked either **[TUNABLE]** (a starting value, to be balanced during playtesting) or **[FIXED]** (structural, not meant to change).

---

# PART I — FOUNDATIONS

## EXECUTIVE SUMMARY

ENGINEERED is a **single-player, 150-second engineering simulation played on a touch screen in front of a crowd**. One participant — the Engineer — inherits a stressed fictional system: a choking city, a flood-exposed district, a strained power grid, a water-starved municipality. They see the system's live variables, they choose from a catalog of engineering actions, the system reacts immediately, the clock burns, a mid-game crisis forces adaptation, and at the 150-second mark the run ends and a 10-year projection resolves every choice into visible consequences.

The result is a score, an **Engineer Archetype** ("The Crisis Engineer"), a set of skill scores, a natural-language system history ("The Metro opened in year 3. Satisfaction surged, but the debt came due in year 7."), a leaderboard position, and a shareable result card — all delivered in roughly 30 seconds, because the next player is already leaning on the table.

Three properties make this memorable rather than generic:

1. **The simulation is the show.** Not a quiz, not a survey, not an animated video. Variables genuinely move in response to genuine inputs, and the crowd can watch the effects on a big screen.
2. **Trade-offs are the gameplay.** Every action helps something and hurts something. There is no universally correct build. Two players can make entirely different choices and both score well; they'll score differently, and their archetypes will differ, and that difference is the conversation at the stall.
3. **Preparation beats luck.** The event system is state-reactive, not a slot machine: floods punish the unprepared proportionally to their unreadiness, and rewards preparation with visible, dramatic outcomes. Randomness shapes *which* pressures arrive, not whether preparation mattered.

What this product deliberately is not: no accounts, no backend-heavy stack, no AI chatbots, no 3D, no long tutorials, no features that exist to look impressive. One laptop or tablet on the stall table; an optional second screen for the leaderboard; local persistence with an optional LAN sync. Three developers can build and balance it in 2–4 days because the design bends around one hard rule: **the simulation engine is generic, the missions are data.**

The sections that follow specify every mechanic concretely: variable definitions with ranges and failure states, the resource model, the decision schema, a general-purpose consequence architecture, a state-reactive event engine, ten missions with distinct strategic identities, the projection and scoring math, ten archetypes, stall operations, UX law, visual identity, and the edge-case ledger. Appendices at the end consolidate the implementation-facing details for the architecture step: the core data schemas, engine pipeline order, tuning workflow, and a compact cross-reference of everything that must exist at ship time.

---

## 1. DESIGN PILLARS

These five pillars are the tie-breakers for every future design argument. When two features conflict, the one that serves the higher pillar wins.

| # | Pillar | Meaning | What it kills |
|---|---|---|---|
| P1 | **The Simulation Is the Show** | Real inputs, real consequences, visible to player and crowd. The crowd must be able to read the drama. | Quiz-like "pick A/B/C" feel; hidden math; silent feedback. |
| P2 | **Trade-offs, Not Answers** | Every meaningful action improves some variables and damages others. Points come from navigating tension, not from "green" choices. | "Correct answer" framing; universally dominant strategies. |
| P3 | **Preparation Beats Luck** | Events scale with the system's state. Resilience pays; neglect is punished fairly and legibly. | Pure RNG drama; coin-flip losses. |
| P4 | **One Breath to Learn, a Week to Master** | Rules fit in a 10-second briefing card. Depth emerges from interactions, not feature count. | Tutorials, tooltips, menus, lore. |
| P5 | **The Stall Is the Platform** | Physical-event realities: queue pressure, spectators, 15-second turnaround, no registration, flaky Wi-Fi. | Login flows, heavy assets, server-authoritative everything. |

Sub-principles under P2, made explicit so they can be tested against content:

1. **No neutral-tax single fix.** If an action improves a headline variable without any cost or side effect, it's not a decision — it's a button. Revise or delete.
2. **Time is a resource.** Some actions cost execution time as well as money; the strongest options are slow.
3. **Strong things gated by context, not just cash.** The best actions have requirements (a prior action, a variable level, a resource) so builds matter.
4. **Bad decisions must be *legible* in hindsight.** The debrief names the player's biggest mistake. Nothing is secretly bad; hidden risks are shown as risk, not concealed entirely.
5. **Every mission has a "tempo."** Some reward few big slow plays, some reward many small fast ones — but never only one.

---

## 2. TARGET PLAYER EXPERIENCE

**The eight-beat emotional arc** (from the brief, made operational):

| Time | Beat | Player feels | Design owner |
|---|---|---|---|
| T0–T10 | CURIOUS | "Oh, I'm in charge of this?" | Briefing card, cold-open |
| T10–T35 | ENGAGED | "Okay, traffic, water, budget — I can fix this." | Dashboard, first action, effects burst |
| T35–T55 | PRESSURED | "So much to do, clock's burning." | Timer prominence, action queue, cost display |
| T55–T75 | SURPRISED | "Wait — WHY is the grid—?!" | Event card, visible dominoes |
| T75–T105 | ADAPTIVE | "Okay okay — triage. Power first." | Event response window, triage actions |
| T105–T130 | TENSE | "Two slots left. What do I *not* do?" | Scarcity (slots + budget + clock) |
| T130–T150 | REVEAL | "Show me what I built." | Projection sequence |
| T150+ | COMPETITIVE | "I can beat that. Again." | Score, archetype, leaderboard, "RUN IT BACK" |

**The critical handoff:** the first action must be obvious within 10 seconds (P4). To guarantee it: the briefing card names the situation and the top objective; the dashboard highlights the variable in the worst state with a red pulse; the highest-impact affordable action sits top-left of the catalog in the same red family. A curious glance resolves "what is this, what's wrong, what do I do" in one pass.

**Spectator experience.** The mirror/spectator display shows the same dashboard at larger scale: variable bars, timer, headline event cards, and a bottom ticker showing the last action taken in one line ("ENGINEER APPROVES METRO EXPANSION — ₹15 Cr COMMITTED"). A spectator who watches 30 seconds should be able to narrate the run's story so far. That's the stall's theater — it also recruits the next player.

**The competitive hook.** Immediate replay is generated by four stacked hooks: the archetype ("I'm *The Optimizer*? I'm not an optimizer—"), the "Biggest Mistake" callout (specific, actionable, fair), a visible leaderboard ("#3 of 14 today — top 3 get a wall mention"), and the final screen's primary button: **RUN IT BACK** (same mission, instant restart).

---

## 3. CORE GAME LOOP

The brief's loop is preserved with one addition — an explicit **debrief epilogue** before the loop closes — because the epilogue is what converts a score into a memory.

```
START
 └─ Mission select (mission deck, 10 cards)                  ~5s
 └─ Name entry (single field, 24-char soft limit, or "AUTO")  ~5s
 └─ BRIEFING card (3 lines: situation / objective / warning)   ~8s
 └─ "INITIALIZE SYSTEM" → dashboard cold-open                  ~2s
 └─ 150-second DECISION PHASE
      ├─ Act I — Stabilize        T0–T50   free agency, catalog open
      ├─ Act II — Crisis          T50–T105 event(s) + response window
      └─ Act III — Endgame        T105–T150 scarcity, final decision
 └─ TIME'S UP — hard stop (queue resolves, input locks)
 └─ 10-YEAR PROJECTION (variable deltas + 3–5 story beats)   ~20s
 └─ SCORE REVEAL (overall, 4 skill bars, archetype)          ~15s
 └─ RESULT CARD (achievements, mistake, leaderboard)         ~10s
 └─ DEBRIEF EPILOGUE (3–5 plain-language cause→effect lines) ~10s
 └─ CHALLENGE / REPLAY / NEXT PLAYER
```

**Identity preserved:** mission → briefing → live system → 150s decisions → system reacts → consequences → events → adaptation → final decision → hard stop → projection → score → archetype → leaderboard → challenge/replay. The epilogue is additive; nothing in the original chain is removed or reordered.

**One run = ~150s play + ~55s aftermath ≈ 3.5 minutes per participant**, giving ~17 players/hour/station, matching a stall day (P5).

---

## 4. THE 150-SECOND SYSTEM

**Total decision time: exactly 150 seconds [FIXED], displayed as a thin bar plus a numeric readout.** Time pressure is the entire drama of the game; the design below spends it deliberately.

### 4.1 Ideal timing structure

| Window | Clock | Phase | What the player should be doing |
|---|---|---|---|---|---|
| 0–15s | Act I opens | Read + first tap | Skim the 3-line situation, spot the red variable, make first move |
| 15–100s | Act I → Act II | Primary engineering decisions | 5–9 deliberate decisions from the catalog |
| 100–130s | Act II peak | Major crisis / event | Respond to 1 major event (response card) + triage |
| 130–145s | Act III | Final strategic decision | One high-impact "endgame choice" |
| 145–150s | — | Final action window | Spend leftover budget/slots, or bank a small bonus |
| 145–150s | — | Hard stop | Input locks; queue resolves; projection begins |

### 4.2 How many decisions fit in 150 seconds?

**7–9 total actions for a first-time player, up to 12 for an expert.** Enforced structurally, not by willpower:

- **Action slots: 10 per run [FIXED]** — a hard cap on total actions taken, including event responses (see below). The clock alone would still allow frantic spam; the slot cap makes every tap a real allocation. 10 slots × ~9s average think+tap time ≈ 90s of deciding, plus reading, event handling, and drift, lands right at 150s.
- **Event responses cost slots.** A major event consumes 1–2 slots from its response card. Crisis response is therefore a genuine allocation, not a free interruption.
- **Endgame choice (T~130) costs 1–2 slots.** It's the most consequential decision of the run, priced accordingly.

Realistic budget of the 150 seconds: ~10s initial read, ~70–80s of catalog decisions (5–9 actions), ~25s on the event(s) and responses, ~15s endgame, ~10s banking leftovers — 130–150s when executed at realistic speed. The clock is the constraint that binds first; slots bind for fast players.

For experts, slots — not seconds — are the binding constraint, and slot efficiency is a skill. **"Actions per Slot" (ApS) is an explicit skill metric** (see §13). An expert's 12th action is possible only if the first 9 were fast and decisive.

### 10-slot budget, typical first-time run (targets, [TUNABLE]):

| Segment | Slots | Typical spend |
|---|---|---|
| Opening moves (2–3 catalog actions) | 3 | ~25s |
| Mid-game development | 3 | ~30s |
| Major event response | 1–2 | ~20s |
| Endgame choice | 1–2 | ~15s |
| Final window banking | 0–1 | ~5s |
| **Total** | **≤10** | **≤150s** |

### 4.3 Decision cadence, pace, and friction

- **Decisions are asynchronous, not sequential locks.** The player acts whenever they want within the phase; there is no "press next round." This preserves agency and keeps the crowd watching free-flowing play.
- **Actions take effect immediately** (same second) unless they carry a Delayed-Effect tag — in which case the effect lands at projection time, and the dashboard shows the pending icon so it never feels swallowed.
- **Execution-time costs exist and are visible.** Each action shows its duration as a thin bar on its tile (e.g., Metro Expansion ≈12s of the clock; Quick Patch ≈2s). While an action "executes," it occupies the **Action Queue** (max 2 concurrent [TUNABLE]) — the player may act again immediately while it runs, but an overeager player who queues three slow actions at T=100 will still be waiting at T=150. Fast actions trade time for weaker, riskier effects (see "flash decisions" below).
- **Flash decisions.** Occasionally the system offers a Flash option on an action tile: a fast, cheap variant with an attached risk (e.g., "Emergency Borewell Permit — 3s, ₹2 Cr, 60% groundwater damage later"). These are deliberately worth more risk per second — a skilled player uses them surgically, a panicking player spams them and gets burned at projection.
- **Preventing mindless clicking of everything:** (a) the 10-slot cap; (b) budget scarcity; (c) every tile shows its downsides before purchase — no hidden trap actions; (d) mutually exclusive pairs (Metro **or** Flyover); (e) a 400ms lock on the confirm button [TUNABLE] to stop double-taps, not to slow play.
- **Preventing UI overwhelm:** the catalog shows **all** actions but visually demotes ones whose requirements are unmet (dimmed, requirement text on tile) — never hidden behind tabs or menus. One screen. No scrolling during Act I in the reference layout (target: 9 visible tiles + response cards; missions with 11–14 actions are permitted to scroll, tested on-stall).
- **Timer fairness:** last-10-seconds pulse is a warning, not a shutdown of mid-flight actions — the queue always resolves after time-up (§4.6). An event response window never expires with less than 20s left on the clock; if the clock would cut a response window short, the window is extended to hold a 20s floor [FIXED].

### 4.4 The final decision moment

At T≈130s, the **Endgame Choice** card slides in: one high-impact, mission-specific dilemma (e.g., "Redirect remaining funds to the monsoon defense program? / Sign the industrial incentive deal?"). It is the run's signature decision — expensive (1–2 slots), mutually exclusive options, no "cancel." It guarantees the run ends on a deliberate, high-stakes note rather than trailing off into small purchases.

### 4.5 Final action window (145–150s)

The catalog dims except for cheap "banking" actions (small variable nudges costing leftover budget, no slot cost [TUNABLE]). Purpose: eliminate dead time and the "I still had money!" regret, which is a replay driver.

### 4.6 Hard stop

At 150s: input locks, the Action Queue completes resolution silently (its effects count — a slow action bought at T=149 still lands, but the player doesn't get to see or react to it; that's the cost of slowness), and the projection sequence begins. The hard stop is absolute; overtime does not exist, so the timer is credible (P4) and stall throughput is protected (P5).

---

## 5. FEEDBACK MODEL

**What it is:** The complete set of channels through which the player and crowd learn what's happening — the reason a simulation can be *felt* in seconds.

**Why it exists:** A simulation that doesn't visibly react reads as a broken form. Feedback converts math into drama (P1).

**How it works — four channels:**

| Channel | Latency | Form | Example |
|---|---|---|---|
| **Variable deltas** | Immediate | Bar moves + floating `▼ TRAFFIC −8` chip at the affected bar | Metro approved → Traffic bar dips as it queues |
| **Status log** (bottom ticker) | Immediate | One-line plain-language history, latest 3 visible | "T+42 — FLYOVER COMPLETED — congestion −4, noise +6" |
| **Effect ledger** (tap any variable) | Immediate | A mini-panel listing everything that moved that variable this run, sorted by size | Tap Pollution → "CNG Fleet −12, Industrial Deal +9, Heatwave +5" |
| **Event cards** | Scheduled | Full-screen interrupt with response options | "FLASH FLOOD WARNING — 20s to respond" |

**How it affects the player:** cause→effect understanding without any tutorial; the ledger doubles as a post-game explanation source for the debrief.

**How it affects replayability:** players return to test a *hypothesis* ("the ledger said flyovers caused noise complaints — if I take transit instead…").

**Implementation note:** the ledger is simply a runtime event list; the debrief and scoring both read it. Build it once, use it three times.

---

# PART II — CORE SYSTEMS

## 6. SYSTEM VARIABLES

**What it is:** The master vocabulary of the simulation — the numeric state of the System.

**Why it exists:** Every decision, event, consequence, score, and sentence in the game is expressed as movement of these variables. A tight, shared vocabulary is what makes the engine generic and missions pure data.

**The global set (13):**

| Icon | Variable | ID | Range | What it represents | Failure state (crossing triggers crisis chain) |
|---|---|---|---|---|---|
| 💰 | Budget | `budget` | ₹0–200 Cr typical; not a 0–100 bar | Spendable funds; also tracked cumulatively as `debt` when negative | `budget < 0` for >60s → **Funding Collapse** (forced austerity event) |
| 🚦 | Mobility | `mobility` | 0–100 | How well people/goods move (inverse of congestion) | < 20 → **Gridlock** (satisfaction/economy drain) |
| 💧 | Water Security | `water` | 0–100 | Supply reliability vs. demand | < 25 → **Water Crisis** possible (event gate) |
| ⚡ | Energy Stability | `energy` | 0–100 | Grid capacity vs. load, backup readiness | < 25 → **Blackout Risk** (event gate) |
| 🌱 | Sustainability | `sustain` | 0–100 | Long-term ecological balance of the system | < 20 → **Degradation Spiral** (slow drain on health/satisfaction) |
| 🌫️ | Pollution | `pollution` | 0–100 (higher = worse) | Air/water/soil contamination | > 75 → **Health Emergency** possible (event gate) |
| 🏗️ | Infrastructure | `infra` | 0–100 | Physical asset condition & capacity | < 20 → **Structural Failure Risk** (event gate) |
| 🛡️ | Resilience | `resilience` | 0–100 | Capacity to absorb shocks (drainage, backups, buffers) | — (never fails alone; it *mediates* every event's damage) |
| 👥 | Citizen Satisfaction | `satisfaction` | 0–100 | Public approval of the Engineer's stewardship | < 30 → **Protests** possible (event gate) |
| 🏥 | Public Health | `health` | 0–100 | Population wellbeing | < 25 → **Epidemic Risk** (event gate) |
| 💡 | Innovation | `innovation` | 0–100 | Technological capability of the system | — (an enabler: unlocks actions & softens outcomes) |
| 🚨 | Emergency Readiness | `readiness` | 0–100 | Preparedness for acute disasters | — (mediates disaster-class events, like resilience) |
| 📈 | Economic Efficiency | `economy` | 0–100 | Productivity & fiscal health of the system | < 20 → **Recession Spiral** (budget income shrinks) |

**Conventions [FIXED]:** all 0–100 variables start each run somewhere in 20–80 (never 0 or 100 — a dead or perfect system is undramatic). Pollution is inverted (low is good). `budget` is denominated in ₹ Cr and mission-scaled. Hidden variables (see below) also live on 0–100.

**Assignment rules — global vs. mission-specific [FIXED]:**

- **Every mission uses:** `budget`, `satisfaction`, `resilience` (the universal triad: money, people, shock-absorption), plus exactly **5–7 headline variables** chosen from the remaining ten.
- **Headline variables** appear as dashboard bars; they're the mission's identity (Traffic mission → Mobility, Pollution, Health, Economy, Infra).
- **Hidden variables** exist in every mission (see below) but are *not* displayed as bars; they're revealed through events and the debrief.
- A mission may introduce **at most one custom variable** (e.g., Campus mission: `reputation`; Mars: `colonist morale`). Custom variables obey the same schema and range rules.

**Hidden variables (global set):**

| Variable | Range | Why hidden | How it surfaces |
|---|---|---|---|
| `debt` | 0–∞ (₹ Cr) | Cumulative borrowing is a slow poison, not a daily worry | Projection: "Interest payments consumed 12% of the budget by 2033" |
| `trust` | 0–100 | Gates protest severity and crisis cooperation | Event flavor: "Citizens rally… / Citizens riot…" |
| `environmental_debt` | 0–100 | Delayed ecological cost of extraction-heavy choices | Projection: "Aquifer drawdown accelerated; year-8 drought hit harder" |
| `tech_level` | 0–100 | Gates Innovation-class actions | Catalog unlock text: "Requires: Tech Level 2" |
| `structural_debt` | 0–100 | Deferred maintenance accumulating silently | Event: "Bridge inspection fails — 3 lanes closed" |

**Relationships.** Variables form a directed effects graph. Authoritative pairings [FIXED] — every mission must respect these directions (magnitudes are mission-tuned):

- Pollution ↑ → Health ↓, Satisfaction ↓ (delayed)
- Mobility ↑ → Economy ↑, Pollution ↑ (if road-biased sources), Satisfaction ↑
- Water ↓ → Health ↓, Economy ↓, Satisfaction ↓
- Energy ↓ → Economy ↓, Health ↓ (hospitals), Readiness ↓
- Infra ↑ → Resilience ↑, Economy ↑; Infra construction → Satisfaction ↓ (disruption), Pollution ↑
- Sustain ↑ → Pollution ↓, Health ↑ (delayed), Resilience ↑ (delayed)
- Economy ↑ → Budget income ↑ (projection), Satisfaction ↑ (delayed)
- Readiness/Resilience ↑ → event damage ↓ (multiplicative, see §10)

No variable may have cycles with period < 1 projection tick that could cause runaway loops; the projection resolver (§12) clamps all values to [0,100] each tick and caps any single tick's movement at ±25 [FIXED] — this kills infinite feedback cascades structurally.

**Scoring influence:** every headline variable contributes to Outcome Score via mission weights (§13); hidden variables contribute via modifiers (debt penalizes, trust multiplies social-impact scoring, environmental_debt penalizes sustainability scoring). **Failure states never instantly end the run** — a failure state fires its crisis chain (an event with harsh, pre-defined damage), and the run *continues*; surviving your own collapse is valid, dramatic gameplay. A run only "hard-fails" if satisfaction hits 0 (citizens have fired the Engineer — see §11).

**How it affects the player:** one glance at the dashboard = one glance at the whole game. Bars, colors, deltas — nothing else.

**How it affects replayability:** 13 variables × ~10 actions × mission weights ≫ one dominant line. Different missions highlight different subsets, so mastery transfers but doesn't trivialize.

**Implementation later:** one `Variable` record (id, icon, label, range, start, invert, hidden flag); one `Mission` record listing its headline set + weights + starting values; the engine treats all variables uniformly.

---

## 7. RESOURCE MODEL

**What it is:** The scarce inputs the Engineer allocates. ENGINEERED has exactly **four resources** [FIXED] — more would blur the dashboard; fewer would flatten the strategy:

| Resource | Regenerates? | Displayed as | Purpose |
|---|---|---|---|
| 💰 **Budget** (`budget`, ₹ Cr) | No, within a run (mission income exists only in the projection) | Numeric readout + thin bar | The primary allocation constraint |
| ⏱ **Time** (the 150s clock) | Never | Timer bar | The pacing constraint |
| ▦ **Action Slots** (10 [FIXED]) | Never | Row of 10 pips, depleting | The decision-consumption constraint |
| 🤝 **Political Capital** (`capital`, 0–100) | Slowly: +1/10s baseline [TUNABLE] | Small meter beside budget | Gates the strongest interventions; models approval feasibility |

**What it is, precisely:**

- **Budget** is mission-scaled (₹80–200 Cr typical start [TUNABLE]) and spendable to zero. Costs are integer Cr; all prices visible pre-purchase.
- **Time** is the clock — spent passively by thinking, actively by action durations (§4.3).
- **Action Slots** are spent by every catalog action (usually 1; endgame 2; some multi-phase actions 2) and by event responses (1–2).
- **Political Capital** is spent by unpopular-but-necessary actions (land acquisition, rationing, industrial deals) and *earned* by popular ones (visible service wins, satisfying promises). It starts at 50 [TUNABLE] in every mission and is the fourth axis of triage: "I can afford it, but do I have the mandate?"

**Deliberately NOT resources:** Energy, Water, Emergency supplies, Approval-as-currency — these are *variables* (§6) with dynamics, not spendable wallets. Mixing the two confuses players; the split is: **resources are spent by the player's will; variables are pushed by the world and the player's ripples.**

**Display rules [FIXED]:** Budget numeric + bar, always top-left; slots as a pips row under the timer; capital as a small labeled meter — these three are *always* visible, never buried. Costs appear on every action tile pre-purchase in `₹ Cr · ⏱s · ▦ slot · 🤝 capital` format (omitting zero entries, e.g. `₹15 Cr · ⏱12s · 🤝−20`).

**Regeneration:** only capital regenerates (slowly). Budget never does within a run — scarcity is the strategic spine. Slots and time never regenerate.

**Overspending, debt, and emergency spending:**

- **Direct overspend is refused** (button disabled; red cost text) — the UI never lets you bounce a check, which avoids a whole class of negative-balance edge cases at the stall.
- **Debt exists as a deliberate tool, not an accident:** the **Emergency Bond** action (present in most missions, cost: 0, grants +₹20–40 Cr instantly) raises `debt`, drains satisfaction slightly, and is priced into the projection ("Interest on emergency bonds consumed ₹X Cr/yr"). Panic borrowing is legal and visible — and punished fairly at projection.
- **Emergency spending:** events may open an "Emergency Powers" response that bypasses capital costs by paying extra budget + satisfaction (models political will in a crisis).
- **Scarcity shapes strategy** by design: budget binds the mission's *scope*, capital binds its *ambition*, slots bind its *variety*, time binds its *depth*. A player who ignores any one axis hits a wall they can name afterward — which is exactly the debrief conversation.

**How it affects the player:** four numbers, instantly legible; every interesting choice is "which constraint do I push against?"

**How it affects replayability:** different missions start with different resource profiles (rich-but-low-capital, poor-but-high-capital), so allocation habits get re-tested.

**Implementation later:** `ResourceState { budget, slotsLeft, capital }` + a single `canAfford(action)` check + a `spend(action)` transaction; the Emergency Bond is just an action with negative cost and side effects.

---

## 8. DECISION SYSTEM

**What it is:** The uniform schema for every engineering choice in the game, and the catalog the player browses.

**Why it exists:** One schema = missions are data files, the engine is written once, balancing is editing numbers rather than code (P5), and every action teaches the same grammar so players get faster on replay.

**The decision schema [FIXED] — every action declares all fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier, used by dependencies/events/score |
| `name` | string | ≤3 words, iconic |
| `desc` | string | ≤90 chars, one line, no lore |
| `cost` | object | `{budget, slots, time, capital}` — any may be 0 |
| `immediate` | effect[] | Applied on execution (visible deltas) |
| `delayed` | effect[] | Applied during projection; shown as "⟳ pending" on the tile |
| `risk` | risk[] | Optional probability-weighted effects (see below) |
| `requires` | condition | Variable thresholds, tech level, prior action ids, capital ≥ x |
| `excludes` | id[] | Mutually exclusive actions (e.g., Metro vs Flyover) |
| `synergies` | id[] | Actions that modify this one if both taken (§8 interactions) |
| `tags` | enum[] | `mobility, water, energy, sustain, social, infra, emergency, innovation, political, flash` |
| `flash` | bool | Fast/risky variant flag |

**Effect format:** `{variable, delta, when?, note?}` — deltas are integers; `when` marks delayed effects landing at a specific projection tick (e.g., year 3).

**Risk format:** `{p, variable, delta, note}` — a probability `p` [TUNABLE per action, typically 0.15–0.4] of an extra effect resolving at projection. Risks are *shown on the tile* (e.g., "⚠ 30%: Construction disruption — Satisfaction −6") because hidden risks violate P4 legibility. The resolution roll happens once, at projection, seeded (§21) so replays of the same seed reproduce it.

**Worked examples** (illustrative magnitudes [TUNABLE], not final constants):

**ACTION: BUILD METRO EXPANSION** `mobility/political`
- COST: ₹15 Cr · ⏱12s · ▦1 · 🤝−20
- IMMEDIATE: Mobility +8, Pollution +4, Satisfaction −3 (construction disruption)
- DELAYED: Mobility +15 (yr 2), Pollution −12 (yr 3), Satisfaction +7 (yr 3), Economy +8 (yr 4)
- RISK: ⚠ 25%: Cost overrun — Budget −5 extra (yr 1)
- REQUIRES: none. EXCLUDES: `flyover_network`

**ACTION: CNG BUS FLEET** `mobility/sustain`
- COST: ₹8 Cr · ⏱6s · ▦1
- IMMEDIATE: Mobility +5, Pollution −6
- DELAYED: Pollution −6 (yr 2), Health +5 (yr 3), Economy +3 (yr 3)
- RISK: ⚠ 15%: Fleet maintenance strain — Economy −3 (yr 4)
- SYNERGY: with `metro_expansion` → Mobility bonus +5 ("last-mile effect")

**ACTION: EMERGENCY BOND** `political/flash`
- COST: 0 budget · ⏱2s · ▦1
- IMMEDIATE: Budget +25, Debt +25 (hidden), Satisfaction −4
- DELAYED: Economy −4 (yr 5, interest drag)
- This is the pressure valve; see §7.

**ACTION: RAIN GARDENS + PERMEABLE Paving** `sustain/flash`
- COST: ₹3 Cr · ⏱4s · ▦1
- IMMEDIATE: Resilience +6, Pollution −3
- DELAYED: Resilience +4 (yr 2), Sustain +5 (yr 3)
- Small, cheap, stackable — the "many small actions" tempo.

**Catalog size:** 9–14 actions per mission [TUNABLE], always including: one flagship big project (excludes its rival), 2–3 mid-size infrastructure actions, 2–3 cheap stackable actions, one emergency/political valve, one innovation-gated action. Endgame choices (§4.4) are separate 2-option cards, not catalog items.

**Dependencies & unlocks:** three gate types [FIXED] — (a) variable thresholds ("requires Water ≥ 40"), (b) tech level ("requires Tech 2"), (c) prior actions ("requires `water_metering`"). Unlocked-but-unaffordable tiles stay bright with red cost text; locked tiles dim with the requirement printed. Nothing is ever hidden.

**Interactions & synergies:** declared pairs grant a small bonus when both are taken (Metro + CNG fleet = last-mile bonus; Drainage + Rain gardens = flood-resilience bonus). This rewards *systems* composition — the literal thesis of the game (P2) — and is scored under Systems Thinking.

**How it affects the player:** every tile answers cost/benefit/risk at a glance; reading a tile takes ~2s, deciding ~5–10s.

**How it affects replayability:** exclusions, synergies, and risk rolls make "the same mission" play differently; experts chase synergy lines.

**Implementation later:** actions as JSON records validated against the schema; a single `execute(action)` transaction (check → spend → apply immediate → mark pending delayed); risk rolls deferred to projection with recorded seeds.

---

## 9. CONSEQUENCE ENGINE

**What it is:** The general-purpose machinery that turns every action and event into rippling, legible system change — the heart of the game.

**Why it exists:** Without structured consequences, ENGINEERED is a list of buttons with tooltips. With it, choices *mean* things beyond their own tile, and the debrief can narrate honest causal chains (P1, P2).

**Five consequence classes [FIXED] — every effect in the game is one of these:**

| Class | Trigger | Latency | Example |
|---|---|---|---|
| **Direct** | Action executed | Immediate | Build CNG fleet → Pollution −6 |
| **Secondary** | A variable crossed a relationship band | Immediate (checked every 5s [TUNABLE]) | Pollution −6 → Health +2 tick, Satisfaction +1 tick |
| **Delayed** | Action's delayed effects | Projection tick (yr N) | Metro's Pollution −12 lands yr 3 |
| **Cascading** | Event or threshold fires | Immediate, wave-based | Flood event → Infra −15 → Economy −8 → Satisfaction −6 → trust −10 |
| **Threshold** | Variable crosses a gate value | Next check cycle | Water < 25 → Water Crisis event becomes *possible* (armed, not auto-fired) |

**Architecture [FIXED]:**

```
Action/Event applied
  → DIRECT effects written to state + ledger
  → RELATIONSHIP PASS: for each changed variable, apply
      secondary effects per §6 relationship table (one wave, damped
      by 0.5 [TUNABLE]; no re-triggering within the same wave)
  → THRESHOLD PASS: compare all variables to gate table;
      arm/disarm gated events; if a gate fires, enqueue its event
  → CASCADE RESOLVER: an event's damage is applied wave-by-wave
      (direct damage → relationship pass → threshold pass), max
      4 waves [FIXED], each wave damped ×0.6 [TUNABLE]
```

**Wave damping** is the core fairness mechanism: cascades decay geometrically, so no decision or disaster creates infinite chain reactions (structurally enforced also by the ±25/tick clamp, §6). The player *sees* the wave: the ledger lists cascade steps as indented arrows, e.g.:

```
FLASH FLOOD
 ├─ Infra −15, Mobility −12, Water Quality — Pollution +8
 │   ├─ wave 2: Economy −8 (from Infra), Health −4 (from Pollution)
 │   └─ wave 3: Satisfaction −6 (from Economy+Health)
 └─ RESILIENCE MEDIATION: your Resilience 62 absorbed 38% of damage
```

**Threshold consequence table (global defaults [TUNABLE per mission]):**

| Gate | Arms event | Note |
|---|---|---|
| Water < 25 | Water Crisis | Prep (storage/recycling) flattens damage |
| Energy < 25 | Blackout Risk | Backup power caps damage |
| Pollution > 75 | Health Emergency | Health system capacity mediates |
| Satisfaction < 30 | Protests | Trust decides protest tone (rally vs. riot) |
| Infra < 20 | Structural Failure | Recent maintenance disarms |
| Economy < 20 | Recession Spiral | Projection-time budget income −30% |
| Debt > 40 | Austerity Event | Forced action: cut one program |
| Sustain < 20 | Degradation Spiral | Slow drain: Health −1/tick, Resilience −1/tick |

Gates **arm** events (they become likely/possible); they do not guarantee instant firing — the event engine (§10) decides timing, which preserves the "state-reactive, not slot-machine" principle (P3).

**Player-facing consequence UX:** every variable delta ≥3 in magnitude [TUNABLE] produces a floating chip at its bar; cascades append to the ledger; threshold crossings flash the bar's edge in the warning color and log a one-line status ("⚠ WATER SECURITY CRITICAL — crisis possible"). The player always knows *why* a thing moved, via the ledger.

**How it affects the player:** decisions feel weighty and *remembered* — the system doesn't forget the industrial deal when the heatwave comes.

**How it affects replayability:** players come back to explore chains ("what if I'd built drainage before the flood?"), which is the deepest form of replay.

**Implementation later:** effects as data; one `applyEffects(list, wave)` function; the three passes run in fixed order every 5s tick and at projection; a deterministic seeded RNG (mulberry32-style) for all rolls, seed recorded per run for reproducibility (§21).

---

## 10. EVENT ENGINE

**What it is:** The scripted-and-state-reactive system that injects surprises — the drama generator.

**Why it exists:** A 150-second allocation exercise with no surprises is a spreadsheet. Events test *adaptation* (a scored skill), reward *preparation* (P3), and give the crowd gasp-moments (P1).

**The two event classes [FIXED]:**

1. **Scheduled Crisis Events** — every run gets exactly one Major crisis, guaranteed, landing in the Act II window (T≈100–130, i.e., inside the §4.1 crisis band). *Which* major event fires is chosen by weighted draw from the mission's event pool, where weights are **modulated by the current system state** (an energy-starved city draws Blackout harder). This is scheduled randomness: guaranteed drama, non-arbitrary selection.
2. **Threshold (Ambient) Events** — 0–2 per run, fired by the §9 gate table (Water Crisis armed by low Water, Protests by low Satisfaction, etc.). These are the consequences of the player's own state — they feel earned, which is the point.

**Event anatomy [FIXED]:**

| Field | Purpose |
|---|---|
| `id, name, icon` | Identity ("⚡ GRID OVERLOAD") |
| `class` | `major` or `ambient` |
| `trigger` | For ambient: `{variable, op, threshold, cooldown}`. For major: `{window: T100–130, weights + state-modulators}` |
| `damage` | Direct effects, pre-mediation (e.g., Infra −15, Mobility −12) |
| `responseOptions` | 2–3 choice cards (spend money/slots/capital for specific mitigations) |
| `noResponsePenalty` | What happens if the player ignores it (always worse than any response) |
| `preparationKey` | Which variable mediates damage (usually Resilience/Readiness) |
| `flavor` | One-line ticker text |

**State-reactive damage (the fairness core):** every event's damage is multiplied by a **mediation factor** derived from its preparation key: `damage × (1 − resilience/150)` [TUNABLE curve, capped at 60% reduction]. Resilience/Readiness 90 → 40% damage taken. Resilience 20 → 87% damage taken. This makes preparation legible: the ledger *shows* "Resilience 62 absorbed 38% of damage."

**Response window [FIXED]:** a Major event opens a **20-second response window** with a visible countdown. Unresponded → `noResponsePenalty` (harsher than any option: e.g., "Unmanaged blackout: Economy −12, Health −8, Satisfaction −10" vs. the response cards' costs). Responses cost slots (1–2) — crisis response is a real allocation, per §4.2. If the window would expire beyond T=150, it's truncated and the penalty auto-applies (rare; hard stop is absolute).

**Event pool examples (cross-mission, each with 2–3 responses; magnitudes [TUNABLE]):**

| Event | Trigger | Damage (unmitigated) | Sample responses |
|---|---|---|---|
| 🌧️ Flash Flood | Monsoon mission (scheduled); ambient in Traffic/Waste | Infra −15, Mobility −12, Pollution +8 | Emergency drainage ops (₹6 Cr); Evacuation + shelters (🤝−10, Health protect); Do nothing (penalty) |
| ⚡ Grid Overload | Energy < 35 or Heatwave | Economy −10, Health −6, Readiness −5 | Rolling blackouts (Economy −4, fairer); Buy diesel gen (₹5 Cr, Pollution +6); Do nothing |
| 💧 Water Main Burst | Infra < 40 ambient | Water −15, Mobility −6 | Emergency repair crew (₹4 Cr); Ration district (🤝−8); Do nothing |
| 🌡️ Extreme Heatwave | Sustain < 30 or Pollution > 60 | Health −10, Energy −8 (AC load), Satisfaction −5 | Cooling centers (₹3 Cr, 🤝−5); Free water points (₹2 Cr); Do nothing |
| 🚨 Hospital Surge | Health < 40 | Health −8, Economy −5, Readiness −4 | Field triage units (₹5 Cr); Redirect ambulance fleet (Readiness −6, Health −2); Do nothing |
| 💸 Budget Cut | Scheduled "fiscal review" variant (some missions) | Budget −15 | Accept quietly (Satisfaction −3); Public appeal (🤝−12, Budget −8 only); Do nothing |
| 🗑️ Waste Fire | Pollution > 65 in Waste mission | Pollution +12, Health −8, Satisfaction −6 | Fire brigade + cleanup (₹4 Cr); Cover-up spin (🤝−15, trust −10, no health fix); Do nothing |
| 📈 Population Spike | Economy > 65 ambient | Mobility −8, Water −6, Energy −6 | Emergency transit (₹5 Cr); Zone freeze (Economy −5); Do nothing |

**Design rules for events [FIXED]:**
1. No event may drop a variable below 5 in one hit (the clamp keeps runs recoverable — a death spiral ends the drama too early).
2. Every event has a `preparationKey`; mitigations always cost less than the unmitigated damage they prevent, but they cost *slots* — preparation is about having budget/slots/capital left when it hits, not about a lucky card.
3. Events never fire in the first 40s (Act I protected for setup) and never two at once (a queued ambient event delays 15s if a major is active).
4. Event text is ≤2 short lines; the crowd must read it from the mirror screen.

**How it affects the player:** mid-run pivot pressure; the "SURPRISED → ADAPTIVE" beats of the arc live here.
**How it affects replayability:** the draw varies, state changes the draw, and the mitigation math invites optimization ("could I hold Resilience 80 and trivialize the flood? That's a build.").
**Implementation later:** events as JSON matching the anatomy table; one scheduler (major, window-randomized) + one gate-listener (ambient); response options are standard actions with a ` crisisOnly` flag.

---

## 11. MISSION ARCHITECTURE

**What it is:** The standard data contract every mission is authored against — one schema, ten (and later more) missions.

**Why it exists:** P5 — "the architecture must support adding new missions without rewriting the game engine." A new mission is a JSON file plus art-free iconography, not a code change.

**The mission record [FIXED]:**

| Field | Contents |
|---|---|
| `meta` | id, title, one-line premise, difficulty (1–5), duration (150, fixed) |
| `briefing` | 3 lines max: SITUATION / YOUR OBJECTIVE / KNOWN RISK |
| `variables` | Headline set (5–7 from §6) + start values + mission weights (Σ=100) + optional one custom variable |
| `budget` | Start ₹ Cr; typical 80–200 |
| `capital` | Start 0–100 (default 50) |
| `actions` | 9–14 action ids (from the shared library + mission-specific ones) + endgame choice (2 options) |
| `eventPool` | Major events (3–5, with state-modulated weights) + ambient gates to arm |
| `scoreWeights` | Mission emphasis: how variable deltas convert to points (§13) |
| `failureCondition` | Universal (satisfaction = 0) plus mission-specific hard-fail (e.g., Mars: colony loss) |
| `successText` | Win/flavor lines for the debrief at score tiers |
| `debriefTemplates` | 4–6 sentence templates keyed to ledger facts (§12) |

**The universal hard-fail [FIXED]:** `satisfaction` reaching 0 at any moment ends the run immediately: "COUNCIL VOTE: the Engineer is dismissed." Everything resolves (projection still runs) with a COUNCIL-DISMISSED stamp. This is the only way to lose mid-run, and it requires sustained neglect — the clamp prevents single events from doing it.

**Mission authoring rules [TUNABLE]:** every mission must (a) have a unique *tension* (see §12 identity column), (b) put ≥2 variables in the 20–40 start band so the opening 15s has a visible "worst bar," (c) include at least one action that looks good but is a trap in the mission's context (the legible trap — risk printed on the tile), and (d) include at least one synergy pair.

**How it affects the player:** mission cards on the select screen communicate identity in one line + three icons; variety is the stall's draw.
**How it affects replayability:** ten identities means ten reasons to return; the schema means an eleventh costs an afternoon.
**Implementation later:** schema validation on load; missions ship as data files; the shared action library covers ~60% of any mission's catalog.