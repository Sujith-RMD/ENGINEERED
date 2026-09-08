import { notFound } from "next/navigation";
import { ALL_MISSIONS, getMission } from "@/data/missions";
import { GameClient } from "@/components/game/GameClient";

export function generateStaticParams() {
  return ALL_MISSIONS.map((m) => ({ missionId: m.id }));
}

export default async function MissionPlayPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const mission = getMission(missionId);
  if (!mission) notFound();
  return <GameClient mission={mission} />;
}
