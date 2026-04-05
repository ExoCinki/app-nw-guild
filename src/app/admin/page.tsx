import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WhitelistManager } from "@/components/whitelist-manager";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const ownerDiscordId = process.env.OWNER_DISCORD_ID;

  if (!session?.user?.discordId || session.user.discordId !== ownerDiscordId) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Administration</h1>
          <p className="mt-2 text-slate-400">
            Gere les serveurs autorises sur cette plateforme.
          </p>
        </div>

        <WhitelistManager />
      </div>
    </main>
  );
}
