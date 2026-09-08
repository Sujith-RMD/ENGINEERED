/**
 * One-command stall launcher: embedded PostgreSQL + schema push + Next.js.
 * Usage: npm run stall
 */
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PG_PORT ?? 55432);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
    child.on("error", reject);
  });
}

async function waitForPostgres(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const { Client } = await import("pg").catch(() => ({ Client: null }));
  if (!Client) return; // pg not installed; prisma will surface errors anyway
  while (Date.now() < deadline) {
    try {
      const client = new Client({
        host: "localhost",
        port,
        user: "engineered",
        password: "engineered",
        database: "engineered",
        connectionTimeoutMillis: 1500,
      });
      await client.connect();
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("PostgreSQL did not become ready in time");
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   ENGINEERED — STALL LAUNCHER                ║");
  console.log("╚══════════════════════════════════════════════╝");

  console.log("[1/4] starting embedded PostgreSQL…");
  const pg = await import("embedded-postgres").then((m) => m.default);
  const postgres = new pg({
    databaseDir: path.join(root, "db"),
    user: "engineered",
    password: "engineered",
    port,
    persistent: true,
  });
  try {
    await postgres.initialise();
    console.log("      cluster initialized");
  } catch (err) {
    if (!(String(err?.message ?? "").includes("already") || err?.code === "EEXIST")) throw err;
    console.log("      existing cluster found");
  }
  await postgres.start();
  console.log(`      postgres ready on :${port}`);

  await waitForPostgres();

  console.log("[2/4] pushing database schema…");
  execSync("npx prisma db push --skip-generate", { cwd: root, stdio: "inherit", shell: true });

  console.log("[3/4] building if needed…");
  try {
    execSync("npx next build", { cwd: root, stdio: "inherit", shell: true });
  } catch (err) {
    console.error("Build failed:", err.message);
    process.exit(1);
  }

  console.log("[4/4] starting ENGINEERED on http://localhost:3000 …");
  const next = spawn("npx", ["next", "start", "-p", "3000"], { cwd: root, stdio: "inherit", shell: true });
  const shutdown = async () => {
    next.kill();
    try {
      await postgres.stop();
    } catch {
      // already stopping
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  next.on("exit", shutdown);
}

main().catch((err) => {
  console.error("[stall] launch failed:", err);
  process.exit(1);
});
