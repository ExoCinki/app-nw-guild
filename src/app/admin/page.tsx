import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WhitelistManager } from "@/components/whitelist-manager";
import { prisma } from "@/lib/prisma";

function maskApiKey(key: string | null): string {
  if (!key) return "Not set";
  if (key.length <= 12) return "*".repeat(key.length);
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const ownerDiscordId = process.env.OWNER_DISCORD_ID;

  if (!session?.user?.discordId || session.user.discordId !== ownerDiscordId) {
    redirect("/");
  }

  const [users, whitelistedGuilds, guildConfigurations] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        name: true,
        email: true,
        discordId: true,
        createdAt: true,
        selectedGuild: {
          select: {
            discordGuildId: true,
            discordGuildName: true,
            selectedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.whitelistedGuild.findMany({
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.guildConfiguration.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const guildNameById = new Map(
    whitelistedGuilds.map((guild) => [
      guild.discordGuildId,
      guild.name ?? guild.discordGuildId,
    ]),
  );

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Administration</h1>
          <p className="mt-2 text-slate-400">
            Users, default server selection, and server configuration overview.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <WhitelistManager />

          <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">Users</h2>
              <span className="text-xs text-slate-400">
                {users.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Discord ID</th>
                    <th className="px-3 py-2">Default server</th>
                    <th className="px-3 py-2">Selected at</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-800/60">
                      <td className="px-3 py-2 font-medium text-slate-100">
                        {user.displayName ?? user.name ?? "Unknown"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {user.email ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {user.discordId ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {user.selectedGuild
                          ? (user.selectedGuild.discordGuildName ??
                            guildNameById.get(
                              user.selectedGuild.discordGuildId,
                            ) ??
                            user.selectedGuild.discordGuildId)
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {user.selectedGuild
                          ? new Date(
                              user.selectedGuild.selectedAt,
                            ).toLocaleString("en-GB")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {new Date(user.createdAt).toLocaleString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">
                Server Configuration
              </h2>
              <span className="text-xs text-slate-400">
                {guildConfigurations.length} configured server(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Server</th>
                    <th className="px-3 py-2">Guild ID</th>
                    <th className="px-3 py-2">API key</th>
                    <th className="px-3 py-2">Channel ID</th>
                    <th className="px-3 py-2">Zoo role</th>
                    <th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {guildConfigurations.map((config) => (
                    <tr
                      key={config.id}
                      className="border-b border-slate-800/60 align-top"
                    >
                      <td className="px-3 py-2 font-medium text-slate-100">
                        {guildNameById.get(config.discordGuildId) ??
                          config.discordGuildId}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {config.discordGuildId}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {maskApiKey(config.apiKey)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {config.channelId ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {config.zooMemberRoleName ??
                          config.zooMemberRoleId ??
                          "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {new Date(config.updatedAt).toLocaleString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
