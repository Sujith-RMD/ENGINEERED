/**
 * Starts the embedded PostgreSQL instance for local dev / stall use.
 * Usage: node scripts/embedded-pg.mjs   (keeps running until Ctrl+C)
 */
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.PG_PORT ?? 55432);

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: process.env.PG_DATA ?? "db",
    user: "engineered",
    password: "engineered",
    port,
    persistent: true,
  });

  process.on("SIGINT", async () => {
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  });

  try {
    await pg.initialise();
    console.log("[stall-db] initialized fresh cluster");
  } catch (err) {
    if (String(err?.message ?? "").includes("already contains") || err?.code === "EEXIST") {
      console.log("[stall-db] existing cluster found");
    } else {
      throw err;
    }
  }
  await pg.start();
  console.log(`[stall-db] postgres ready on port ${port}`);
}

main().catch((err) => {
  console.error("[stall-db] failed:", err);
  process.exit(1);
});
