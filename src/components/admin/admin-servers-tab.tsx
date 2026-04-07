"use client";

import type { AdminGuild } from "@/components/admin/admin-types";

type Props = {
  guilds: AdminGuild[];
};

export function AdminServersTab({ guilds }: Props) {
  return (
    <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
      <div className="mb-3 text-lg font-semibold text-slate-100">
        Serveurs relies
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {guilds.map((guild) => (
          <div
            key={guild.discordGuildId}
            className="rounded border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm"
          >
            <div className="font-medium text-slate-100">
              {guild.name ?? guild.discordGuildId}
            </div>
            <div className="text-xs text-slate-400">{guild.discordGuildId}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
