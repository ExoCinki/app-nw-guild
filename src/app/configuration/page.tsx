import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ServerConfigurationCard } from "@/components/server-configuration-card";

export default async function ConfigurationPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Configuration</h1>
          <p className="mt-2 text-slate-400">
            Configure la cle API et le Discord Channel ID du serveur
            selectionne.
          </p>
        </div>

        <ServerConfigurationCard />
      </div>
    </main>
  );
}
