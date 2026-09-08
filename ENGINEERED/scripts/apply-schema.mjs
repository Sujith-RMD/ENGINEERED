// Schema bootstrap without the Prisma schema engine (spawn-restricted
// environments): apply the same DDL Prisma would generate, over a plain
// pg socket. Mirrors prisma/schema.prisma exactly.
import pg from "pg";

const DDL = `
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL DEFAULT 'normal',
  "rngSeed" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Session_status_createdAt_idx" ON "Session"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "Decision" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "tSeconds" INTEGER NOT NULL,
  "actionId" TEXT NOT NULL,
  "eventId" TEXT,
  "stateBefore" JSONB NOT NULL,
  "stateAfter" JSONB NOT NULL,
  "cost" JSONB NOT NULL,
  "consequence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Decision_sessionId_seq_idx" ON "Decision"("sessionId", "seq");

CREATE TABLE IF NOT EXISTS "Result" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "playerName" TEXT,
  "score" INTEGER NOT NULL,
  "archetypeId" TEXT NOT NULL,
  "metrics" JSONB NOT NULL,
  "finalState" JSONB NOT NULL,
  "projection" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "shareId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Result_sessionId_key" ON "Result"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Result_shareId_key" ON "Result"("shareId");
CREATE INDEX IF NOT EXISTS "Result_missionId_score_idx" ON "Result"("missionId", "score");

CREATE TABLE IF NOT EXISTS "LeaderboardEntry" (
  "id" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "playerName" TEXT,
  "score" INTEGER NOT NULL,
  "day" TEXT NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeaderboardEntry_resultId_key" ON "LeaderboardEntry"("resultId");
CREATE INDEX IF NOT EXISTS "LeaderboardEntry_day_score_idx" ON "LeaderboardEntry"("day", "score");
CREATE INDEX IF NOT EXISTS "LeaderboardEntry_missionId_score_idx" ON "LeaderboardEntry"("missionId", "score");

CREATE TABLE IF NOT EXISTS "AdminSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Decision_sessionId_fkey'
  ) THEN
    ALTER TABLE "Decision" ADD CONSTRAINT "Decision_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Result_sessionId_fkey'
  ) THEN
    ALTER TABLE "Result" ADD CONSTRAINT "Result_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaderboardEntry_resultId_fkey'
  ) THEN
    ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_resultId_fkey"
      FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

const client = new pg.Client({
  host: "localhost",
  port: 55432,
  user: "engineered",
  password: "engineered",
  database: "engineered",
});

try {
  await client.connect();
  await client.query(DDL);
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("[schema] applied:", tables.rows.map((r) => r.table_name).join(", "));
} finally {
  await client.end();
}
