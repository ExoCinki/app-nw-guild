import { redirect } from "next/navigation";
import { getCurrentUserAccessState } from "@/lib/current-user-access";
import ScoreboardClient from "./scoreboard-client";

export default async function ScoreboardPage() {
  const accessState = await getCurrentUserAccessState();

  if (accessState.status !== "ok" || !accessState.access.scoreboard) {
    redirect("/");
  }

  return <ScoreboardClient />;
}
