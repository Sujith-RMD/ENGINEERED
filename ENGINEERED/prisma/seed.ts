/**
 * Seeds default AdminSettings. No fake leaderboard rows — the board starts
 * empty and honest.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.adminSetting.upsert({
    where: { key: "enabledMissions" },
    update: {},
    create: { key: "enabledMissions", value: { all: true } },
  });
  console.log("[seed] admin settings ready — leaderboard intentionally empty");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
