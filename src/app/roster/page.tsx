import { redirect } from "next/navigation";
import { RosterCard } from "@/components/roster-card";
import { getCurrentUserAccessState } from "@/lib/current-user-access";

export default async function RosterPage() {
  const accessState = await getCurrentUserAccessState();

  if (accessState.status !== "ok" || !accessState.access.roster) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-screen-xl">
        <RosterCard />
      </div>
    </main>
  );
}
