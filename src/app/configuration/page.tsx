import { redirect } from "next/navigation";
import { ServerConfigurationCard } from "@/components/server-configuration-card";
import { getCurrentUserAccessState } from "@/lib/current-user-access";

export default async function ConfigurationPage() {
  const accessState = await getCurrentUserAccessState();

  if (accessState.status !== "ok" || !accessState.access.configuration) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Configuration</h1>
          <p className="mt-2 text-slate-400">
            Configure the API key and Discord channel ID for the selected
            server.
          </p>
        </div>

        <ServerConfigurationCard />
      </div>
    </main>
  );
}
