"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingIndicator } from "@/components/loading-indicator";
import { WhitelistManager } from "@/components/whitelist-manager";
import { AdminUsersTab } from "@/components/admin/admin-users-tab";
import { AdminAccessTab } from "@/components/admin/admin-access-tab";
import { AdminConfigurationTab } from "@/components/admin/admin-configuration-tab";
import { AdminBansTab } from "@/components/admin/admin-bans-tab";
import type { AdminGlobalResponse } from "@/components/admin/admin-types";

async function fetchAdminGlobalData() {
  const response = await fetch("/api/admin/global", { credentials: "include" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Unable to load admin data");
  }
  return response.json() as Promise<AdminGlobalResponse>;
}

type Tab = "users" | "access" | "configuration" | "bans" | "whitelist";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "access", label: "Acces" },
  { id: "configuration", label: "Configuration" },
  { id: "bans", label: "Bans" },
  { id: "whitelist", label: "Whitelist" },
];

export function GlobalAdminManager() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  const query = useQuery({
    queryKey: ["admin-global"],
    queryFn: fetchAdminGlobalData,
  });

  if (query.isLoading) {
    return <LoadingIndicator />;
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border border-red-700/50 bg-red-950/30 p-4 text-red-300">
        {query.error instanceof Error
          ? query.error.message
          : "Unable to load admin data"}
      </div>
    );
  }

  const guilds = query.data?.guilds ?? [];
  const users = query.data?.users ?? [];
  const bans = query.data?.bans ?? [];
  const accesses = query.data?.accesses ?? [];
  const configurations = query.data?.configurations ?? [];
  const globalAdmins = query.data?.globalAdmins ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800/60 bg-slate-900/70 p-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-2 text-sm transition ${
              activeTab === tab.id
                ? "bg-blue-700 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" ? (
        <AdminUsersTab users={users} guilds={guilds} />
      ) : null}

      {activeTab === "access" ? (
        <AdminAccessTab users={users} guilds={guilds} accesses={accesses} globalAdmins={globalAdmins} />
      ) : null}

      {activeTab === "configuration" ? (
        <AdminConfigurationTab
          guilds={guilds}
          configurations={configurations}
        />
      ) : null}

      {activeTab === "bans" ? <AdminBansTab users={users} bans={bans} /> : null}

      {activeTab === "whitelist" ? <WhitelistManager /> : null}
    </div>
  );
}
