import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/server/adminAuth";
import { setEnabledMissionIds } from "@/lib/server/settings";
import { jsonError } from "@/lib/server/http";

const schema = z.object({ missionIds: z.array(z.string()).max(50) });

export async function POST(request: Request) {
  if (!(await isAdmin())) return jsonError(401, "Unauthorized");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid mission list");
  await setEnabledMissionIds(parsed.data.missionIds);
  return NextResponse.json({ ok: true, enabled: parsed.data.missionIds });
}
