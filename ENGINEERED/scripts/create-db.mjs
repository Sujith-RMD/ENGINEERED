// One-shot helper: create the engineered database if missing (no spawn, pure socket).
import pg from "pg";

const client = new pg.Client({
  host: "localhost",
  port: 55432,
  user: "engineered",
  password: "engineered",
  database: "postgres",
});

try {
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'engineered'");
  if (res.rowCount === 0) {
    await client.query("CREATE DATABASE engineered OWNER engineered");
    console.log("[db] created database 'engineered'");
  } else {
    console.log("[db] database 'engineered' already exists");
  }
} finally {
  await client.end();
}
