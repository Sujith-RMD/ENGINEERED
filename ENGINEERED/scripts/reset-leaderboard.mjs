// Reset leaderboard / results / sessions. For the organizer: a clean board
// between shows. Usage: node scripts/reset-leaderboard.mjs [--all]
//   (default) delete today's leaderboard entries + their results
//   --all     delete every session, result and leaderboard row
import pg from "pg";

const all = process.argv.includes("--all");

const client = new pg.Client({
  host: "localhost",
  port: 55432,
  user: "engineered",
  password: "engineered",
  database: "engineered",
});

try {
  await client.connect();
  const day = new Date().toISOString().slice(0, 10);
  if (all) {
    await client.query('DELETE FROM "LeaderboardEntry"');
    await client.query('DELETE FROM "Result"');
    await client.query('DELETE FROM "Decision"');
    await client.query('DELETE FROM "Session"');
    console.log("[reset] all leaderboard, results and sessions cleared");
  } else {
    await client.query('DELETE FROM "LeaderboardEntry" WHERE "day" = $1', [day]);
    await client.query(
      'DELETE FROM "Result" WHERE "sessionId" IN (SELECT id FROM "Session" WHERE "createdAt"::date = $1)',
      [day]
    );
    console.log(`[reset] today's (${day}) leaderboard entries cleared`);
  }
} finally {
  await client.end();
}
