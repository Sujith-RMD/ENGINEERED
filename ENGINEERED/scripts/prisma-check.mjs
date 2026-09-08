// Sanity check: PrismaClient (in-process query engine) against the live DB.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const sessions = await prisma.session.count();
  const settings = await prisma.adminSetting.count();
  console.log(`[prisma] OK — sessions: ${sessions}, settings: ${settings}`);
  await prisma.adminSetting.upsert({
    where: { key: "enabledMissions" },
    update: {},
    create: { key: "enabledMissions", value: { all: true } },
  });
  console.log("[prisma] admin settings seeded");
} finally {
  await prisma.$disconnect();
}
