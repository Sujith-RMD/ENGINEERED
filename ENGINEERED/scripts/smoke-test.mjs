// End-to-end smoke test against a running production server.
// Usage: node scripts/smoke-test.mjs [baseUrl]
const BASE = process.argv[2] ?? "http://localhost:3000";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  // 1. Landing page
  const home = await fetch(BASE);
  check("GET /", home.ok, `status ${home.status}`);
  const homeHtml = await home.text();
  check("landing shows ENGINEERED", homeHtml.includes("ENGINEERED"));

  // 2. Create a session
  const sessRes = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ missionId: "city-gridlock", difficulty: "normal" }),
  });
  check("POST /api/sessions", sessRes.ok, `status ${sessRes.status}`);
  const session = await sessRes.json();
  check("session has id + seed", Boolean(session.sessionId) && Number.isFinite(session.seed), JSON.stringify(session).slice(0, 80));

  // 3. Submit a replayed run (server re-simulates authoritatively)
  const actions = [
    { actionId: "smart-traffic-signals", t: 6 },
    { actionId: "metro-expansion", t: 20 },
    { actionId: "congestion-pricing", t: 45 },
  ];
  const resultRes = await fetch(`${BASE}/api/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: session.sessionId, playerName: "SMOKE TEST", actions }),
  });
  check("POST /api/results", resultRes.ok, `status ${resultRes.status}`);
  const result = await resultRes.json();
  check("result has shareId + score", Boolean(result.shareId) && Number.isFinite(result.score), `score=${result.score} shareId=${result.shareId}`);
  check("score in 0..100", result.score >= 0 && result.score <= 100, `${result.score}`);
  check("archetype assigned", Boolean(result.archetype?.id), result.archetype?.name ?? "");
  check("projection deltas present", Array.isArray(result.projection?.deltas) && result.projection.deltas.length > 0, `${result.projection?.deltas?.length ?? 0} deltas`);

  // 4. Duplicate submission must be rejected
  const dup = await fetch(`${BASE}/api/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: session.sessionId, playerName: "CHEATER", actions }),
  });
  check("duplicate submission rejected (409)", dup.status === 409, `status ${dup.status}`);

  // 5. Tampered score can't be injected (server recomputes): submitting to a
  // fresh session with an unknown action id must fail cleanly.
  const sess2 = await (await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ missionId: "city-gridlock", difficulty: "normal" }),
  })).json();
  const badRes = await fetch(`${BASE}/api/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: sess2.sessionId, actions: [{ actionId: "hack-the-planet", t: 3 }] }),
  });
  check("invalid action rejected (400)", badRes.status === 400, `status ${badRes.status}`);

  // 6. Leaderboard contains the result
  const board = await (await fetch(`${BASE}/api/leaderboard?scope=today`)).json();
  const mine = board.entries?.find((e) => e.id && e.playerName === "SMOKE TEST");
  check("leaderboard lists submission", Boolean(mine), board.entries?.length ? `top score ${board.entries[0].score}` : "no entries");

  // 7. Share page renders
  const share = await fetch(`${BASE}/results/${result.shareId}`);
  check("GET /results/[shareId]", share.ok, `status ${share.status}`);
  const shareHtml = await share.text();
  check("share page shows score", shareHtml.includes(String(result.score)));

  // 8. Admin flow
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: "ENGINEER-2046" }),
  });
  check("admin login", login.ok, `status ${login.status}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  const overview = await fetch(`${BASE}/api/admin/overview`, { headers: { cookie } });
  check("admin overview (authed)", overview.ok, `status ${overview.status}`);
  const ov = await overview.json();
  check("overview lists missions", Array.isArray(ov.missions) && ov.missions.length === 10, `${ov.missions?.length ?? 0} missions`);
  const unauth = await fetch(`${BASE}/api/admin/overview`);
  check("admin overview blocked without cookie", unauth.status === 401, `status ${unauth.status}`);

  // 9. Mission toggle round-trip
  const toggle = await fetch(`${BASE}/api/admin/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ missionIds: ["city-gridlock", "floodline", "last-drop", "blackout", "zero-waste", "critical", "campus-2040", "city-2040", "fireline", "mars-habitat"] }),
  });
  check("admin mission toggle", toggle.ok, `status ${toggle.status}`);

  // 10. Other pages render
  for (const path of ["/play", "/play/city-gridlock", "/leaderboard", "/admin"]) {
    const r = await fetch(`${BASE}${path}`);
    check(`GET ${path}`, r.ok, `status ${r.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("SMOKE TEST CRASHED:", err);
  process.exit(1);
});
