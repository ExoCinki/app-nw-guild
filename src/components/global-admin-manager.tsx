"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoadingIndicator } from "@/components/loading-indicator";

type AdminGlobalResponse = {
  guilds: Array<{
    discordGuildId: string;
    name: string | null;
    createdAt: string;
  }>;
  users: Array<{
    id: string;
    discordId: string | null;
    displayName: string | null;
    name: string | null;
    email: string | null;
    selectedGuild: {
      discordGuildId: string;
      discordGuildName: string | null;
      selectedAt: string;
    } | null;
    createdAt: string;
  }>;
  accesses: Array<{
    userId: string;
    discordGuildId: string;
    canReadRoster: boolean;
    canWriteRoster: boolean;
    canReadPayout: boolean;
    canWritePayout: boolean;
    canReadConfiguration: boolean;
    canWriteConfiguration: boolean;
    updatedAt: string;
  }>;
  bans: Array<{
    discordId: string;
    reason: string | null;
    createdAt: string;
    bannedByUserId: string | null;
  }>;
  configurations: Array<{
    discordGuildId: string;
    apiKey: string | null;
    channelId: string | null;
    zooMemberRoleId: string | null;
    zooMemberRoleName: string | null;
    warsCount: number;
    racesCount: number;
    invasionsCount: number;
    vodsCount: number;
    reviewsCount: number;
    bonusCount: number;
    updatedAt: string;
  }>;
};

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

export function GlobalAdminManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "servers" | "users" | "access" | "configuration" | "bans"
  >("servers");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [canReadRoster, setCanReadRoster] = useState(true);
  const [canWriteRoster, setCanWriteRoster] = useState(true);
  const [canReadPayout, setCanReadPayout] = useState(true);
  const [canWritePayout, setCanWritePayout] = useState(true);
  const [canReadConfiguration, setCanReadConfiguration] = useState(true);
  const [canWriteConfiguration, setCanWriteConfiguration] = useState(true);

  const [configGuildId, setConfigGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [zooMemberRoleId, setZooMemberRoleId] = useState("");
  const [zooMemberRoleName, setZooMemberRoleName] = useState("");
  const [warsCount, setWarsCount] = useState("0");
  const [racesCount, setRacesCount] = useState("0");
  const [invasionsCount, setInvasionsCount] = useState("0");
  const [vodsCount, setVodsCount] = useState("0");
  const [reviewsCount, setReviewsCount] = useState("0");
  const [bonusCount, setBonusCount] = useState("0");

  const [banDiscordId, setBanDiscordId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [managedUserId, setManagedUserId] = useState("");
  const [managedUserDisplayName, setManagedUserDisplayName] = useState("");
  const [managedUserSelectedGuildId, setManagedUserSelectedGuildId] =
    useState("");

  const query = useQuery({
    queryKey: ["admin-global"],
    queryFn: fetchAdminGlobalData,
  });

  function applyAccessPreset(nextUserId: string, nextGuildId: string) {
    const match = query.data?.accesses.find(
      (item) =>
        item.userId === nextUserId && item.discordGuildId === nextGuildId,
    );
    setCanReadRoster(match?.canReadRoster ?? true);
    setCanWriteRoster(match?.canWriteRoster ?? true);
    setCanReadPayout(match?.canReadPayout ?? true);
    setCanWritePayout(match?.canWritePayout ?? true);
    setCanReadConfiguration(match?.canReadConfiguration ?? true);
    setCanWriteConfiguration(match?.canWriteConfiguration ?? true);
  }

  function applyConfigPreset(nextGuildId: string) {
    const config = query.data?.configurations.find(
      (item) => item.discordGuildId === nextGuildId,
    );

    if (!config) {
      setChannelId("");
      setApiKey("");
      setZooMemberRoleId("");
      setZooMemberRoleName("");
      setWarsCount("0");
      setRacesCount("0");
      setInvasionsCount("0");
      setVodsCount("0");
      setReviewsCount("0");
      setBonusCount("0");
      return;
    }

    setChannelId(config.channelId ?? "");
    setApiKey(config.apiKey ?? "");
    setZooMemberRoleId(config.zooMemberRoleId ?? "");
    setZooMemberRoleName(config.zooMemberRoleName ?? "");
    setWarsCount(String(config.warsCount));
    setRacesCount(String(config.racesCount));
    setInvasionsCount(String(config.invasionsCount));
    setVodsCount(String(config.vodsCount));
    setReviewsCount(String(config.reviewsCount));
    setBonusCount(String(config.bonusCount));
  }

  const accessMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "set-access",
          userId: selectedUserId,
          guildId: selectedGuildId,
          canReadRoster,
          canWriteRoster,
          canReadPayout,
          canWritePayout,
          canReadConfiguration,
          canWriteConfiguration,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to save access");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Access rights updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const configMutation = useMutation({
    mutationFn: async () => {
      const parseIntField = (value: string, label: string) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed < 0) {
          throw new Error(`${label} must be an integer >= 0`);
        }
        return parsed;
      };

      const response = await fetch("/api/admin/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "set-config",
          guildId: configGuildId,
          channelId,
          apiKey,
          zooMemberRoleId,
          zooMemberRoleName,
          warsCount: parseIntField(warsCount, "warsCount"),
          racesCount: parseIntField(racesCount, "racesCount"),
          invasionsCount: parseIntField(invasionsCount, "invasionsCount"),
          vodsCount: parseIntField(vodsCount, "vodsCount"),
          reviewsCount: parseIntField(reviewsCount, "reviewsCount"),
          bonusCount: parseIntField(bonusCount, "bonusCount"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to save configuration");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Configuration updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const banMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discordId: banDiscordId, reason: banReason }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to ban user");
      }
      return response.json();
    },
    onSuccess: async () => {
      setBanDiscordId("");
      setBanReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Discord user banned");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unbanMutation = useMutation({
    mutationFn: async (discordId: string) => {
      const response = await fetch(
        `/api/admin/global?discordId=${encodeURIComponent(discordId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to unban user");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Discord user unbanned");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const userMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "set-user",
          userId: managedUserId,
          displayName: managedUserDisplayName,
          selectedGuildId: managedUserSelectedGuildId || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to update user");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Utilisateur mis a jour");
    },
    onError: (error: Error) => toast.error(error.message),
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
  const accessOverrides = query.data?.accesses ?? [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const guildById = new Map(
    guilds.map((guild) => [guild.discordGuildId, guild]),
  );
  const filteredUsers = users.filter((user) => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const label =
      `${user.displayName ?? ""} ${user.name ?? ""} ${user.email ?? ""} ${user.discordId ?? ""}`.toLowerCase();
    return label.includes(q);
  });

  function loadManagedUser(userId: string) {
    const user = users.find((u) => u.id === userId);
    setManagedUserId(userId);
    setManagedUserDisplayName(user?.displayName ?? "");
    setManagedUserSelectedGuildId(user?.selectedGuild?.discordGuildId ?? "");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800/60 bg-slate-900/70 p-2">
        {[
          { id: "servers", label: "Serveurs" },
          { id: "users", label: "Users" },
          { id: "access", label: "Acces" },
          { id: "configuration", label: "Configuration" },
          { id: "bans", label: "Bans" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              setActiveTab(
                tab.id as
                  | "servers"
                  | "users"
                  | "access"
                  | "configuration"
                  | "bans",
              )
            }
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

      {activeTab === "servers" ? (
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
                <div className="text-xs text-slate-400">
                  {guild.discordGuildId}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "users" ? (
        <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
          <div className="mb-4 text-lg font-semibold text-slate-100">
            Gestion utilisateurs
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <select
              value={managedUserId}
              onChange={(e) => loadManagedUser(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Selectionner un user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName ?? user.name ?? user.email ?? "Unknown"}
                </option>
              ))}
            </select>

            <input
              value={managedUserDisplayName}
              onChange={(e) => setManagedUserDisplayName(e.target.value)}
              placeholder="Display name"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />

            <select
              value={managedUserSelectedGuildId}
              onChange={(e) => setManagedUserSelectedGuildId(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Aucun serveur par defaut</option>
              {guilds.map((guild) => (
                <option key={guild.discordGuildId} value={guild.discordGuildId}>
                  {guild.name ?? guild.discordGuildId}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!managedUserId) {
                toast.error("Selectionne un user");
                return;
              }
              userMutation.mutate();
            }}
            disabled={userMutation.isPending}
            className="mt-4 rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Enregistrer utilisateur
          </button>

          <div className="mt-6 overflow-x-auto rounded border border-slate-700">
            <table className="min-w-full text-xs text-slate-200">
              <thead className="bg-slate-800/90 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Discord ID</th>
                  <th className="px-3 py-2 text-left">Serveur par defaut</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-700/70">
                    <td className="px-3 py-2">
                      {user.displayName ?? user.name ?? user.email ?? "Unknown"}
                    </td>
                    <td className="px-3 py-2">{user.discordId ?? "-"}</td>
                    <td className="px-3 py-2">
                      {user.selectedGuild?.discordGuildName ??
                        user.selectedGuild?.discordGuildId ??
                        "-"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => loadManagedUser(user.id)}
                        className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "access" ? (
        <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
          <div className="mb-4 text-lg font-semibold text-slate-100">
            Droits utilisateur par serveur
          </div>

          <input
            type="text"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder="Rechercher un user (nom, mail, discord id)..."
            className="mb-3 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />

          <div className="mb-3 text-xs text-slate-400">
            {filteredUsers.length} utilisateur(s) trouve(s)
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <select
              value={selectedUserId}
              onChange={(e) => {
                const nextUserId = e.target.value;
                setSelectedUserId(nextUserId);
                applyAccessPreset(nextUserId, selectedGuildId);
              }}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Selectionner un user</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName ?? user.name ?? user.email ?? "Unknown"} -{" "}
                  {user.discordId ?? "no discordId"}
                </option>
              ))}
            </select>

            <select
              value={selectedGuildId}
              onChange={(e) => {
                const nextGuildId = e.target.value;
                setSelectedGuildId(nextGuildId);
                applyAccessPreset(selectedUserId, nextGuildId);
              }}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Selectionner un serveur</option>
              {guilds.map((guild) => (
                <option key={guild.discordGuildId} value={guild.discordGuildId}>
                  {guild.name ?? guild.discordGuildId}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCanReadRoster(true);
                  setCanWriteRoster(true);
                  setCanReadPayout(true);
                  setCanWritePayout(true);
                  setCanReadConfiguration(true);
                  setCanWriteConfiguration(true);
                }}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                Tout autoriser
              </button>
              <button
                type="button"
                onClick={() => {
                  setCanReadRoster(true);
                  setCanWriteRoster(false);
                  setCanReadPayout(true);
                  setCanWritePayout(false);
                  setCanReadConfiguration(true);
                  setCanWriteConfiguration(false);
                }}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                Lecture seulement partout
              </button>
              <button
                type="button"
                onClick={() => {
                  setCanReadRoster(false);
                  setCanWriteRoster(false);
                  setCanReadPayout(false);
                  setCanWritePayout(false);
                  setCanReadConfiguration(false);
                  setCanWriteConfiguration(false);
                }}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                Tout retirer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded border border-slate-700 bg-slate-800/60 p-2">
                <div className="mb-2 font-medium">Roster</div>
                <label className="mr-3 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={canReadRoster}
                    onChange={(e) => {
                      setCanReadRoster(e.target.checked);
                      if (!e.target.checked) setCanWriteRoster(false);
                    }}
                  />
                  Read
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={canWriteRoster}
                    onChange={(e) => {
                      setCanWriteRoster(e.target.checked);
                      if (e.target.checked) setCanReadRoster(true);
                    }}
                  />
                  Write
                </label>
              </div>

              <div className="rounded border border-slate-700 bg-slate-800/60 p-2">
                <div className="mb-2 font-medium">Payout</div>
                <label className="mr-3 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={canReadPayout}
                    onChange={(e) => {
                      setCanReadPayout(e.target.checked);
                      if (!e.target.checked) setCanWritePayout(false);
                    }}
                  />
                  Read
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={canWritePayout}
                    onChange={(e) => {
                      setCanWritePayout(e.target.checked);
                      if (e.target.checked) setCanReadPayout(true);
                    }}
                  />
                  Write
                </label>
              </div>

              <div className="rounded border border-slate-700 bg-slate-800/60 p-2">
                <div className="mb-2 font-medium">Configuration</div>
                <label className="mr-3 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={canReadConfiguration}
                    onChange={(e) => {
                      setCanReadConfiguration(e.target.checked);
                      if (!e.target.checked) setCanWriteConfiguration(false);
                    }}
                  />
                  Read
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={canWriteConfiguration}
                    onChange={(e) => {
                      setCanWriteConfiguration(e.target.checked);
                      if (e.target.checked) setCanReadConfiguration(true);
                    }}
                  />
                  Write
                </label>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selectedUserId || !selectedGuildId) {
                toast.error("Select a user and a server first");
                return;
              }
              accessMutation.mutate();
            }}
            disabled={accessMutation.isPending}
            className="mt-4 rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Enregistrer les droits
          </button>

          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-slate-200">
              Regles explicites actives
            </div>
            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="min-w-full text-xs text-slate-200">
                <thead className="bg-slate-800/90 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Utilisateur</th>
                    <th className="px-3 py-2 text-left">Serveur</th>
                    <th className="px-3 py-2 text-left">Roster</th>
                    <th className="px-3 py-2 text-left">Payout</th>
                    <th className="px-3 py-2 text-left">Configuration</th>
                    <th className="px-3 py-2 text-left">Regle explicite</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accessOverrides.map((row) => {
                    const user = userById.get(row.userId);
                    const guild = guildById.get(row.discordGuildId);

                    const formatPerm = (
                      canRead: boolean,
                      canWrite: boolean,
                    ) => {
                      if (!canRead) return "Aucun";
                      return canWrite ? "Read/Write" : "Read";
                    };

                    return (
                      <tr
                        key={`${row.userId}-${row.discordGuildId}`}
                        className="border-t border-slate-700/70"
                      >
                        <td className="px-3 py-2">
                          {user?.displayName ??
                            user?.name ??
                            user?.email ??
                            row.userId}
                        </td>
                        <td className="px-3 py-2">
                          {guild?.name ?? row.discordGuildId}
                        </td>
                        <td className="px-3 py-2">
                          {formatPerm(row.canReadRoster, row.canWriteRoster)}
                        </td>
                        <td className="px-3 py-2">
                          {formatPerm(row.canReadPayout, row.canWritePayout)}
                        </td>
                        <td className="px-3 py-2">
                          {formatPerm(
                            row.canReadConfiguration,
                            row.canWriteConfiguration,
                          )}
                        </td>
                        <td className="px-3 py-2 text-emerald-300">Oui</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(row.userId);
                              setSelectedGuildId(row.discordGuildId);
                              applyAccessPreset(row.userId, row.discordGuildId);
                            }}
                            className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                          >
                            Charger
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {accessOverrides.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-400" colSpan={7}>
                        Aucune regle explicite enregistree.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "configuration" ? (
        <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
          <div className="mb-4 text-lg font-semibold text-slate-100">
            Configuration serveur (admin global)
          </div>
          <select
            value={configGuildId}
            onChange={(e) => {
              const nextGuildId = e.target.value;
              setConfigGuildId(nextGuildId);
              applyConfigPreset(nextGuildId);
            }}
            className="mb-4 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Selectionner un serveur</option>
            {guilds.map((guild) => (
              <option key={guild.discordGuildId} value={guild.discordGuildId}>
                {guild.name ?? guild.discordGuildId}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Channel ID"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={zooMemberRoleId}
              onChange={(e) => setZooMemberRoleId(e.target.value)}
              placeholder="Zoo role ID"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={zooMemberRoleName}
              onChange={(e) => setZooMemberRoleName(e.target.value)}
              placeholder="Zoo role name"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={warsCount}
              onChange={(e) => setWarsCount(e.target.value)}
              placeholder="Wars points"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={racesCount}
              onChange={(e) => setRacesCount(e.target.value)}
              placeholder="Races points"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={invasionsCount}
              onChange={(e) => setInvasionsCount(e.target.value)}
              placeholder="Invasions points"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={vodsCount}
              onChange={(e) => setVodsCount(e.target.value)}
              placeholder="VODs points"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={reviewsCount}
              onChange={(e) => setReviewsCount(e.target.value)}
              placeholder="Reviews points"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={bonusCount}
              onChange={(e) => setBonusCount(e.target.value)}
              placeholder="Bonus points"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!configGuildId) {
                toast.error("Select a server first");
                return;
              }
              configMutation.mutate();
            }}
            disabled={configMutation.isPending}
            className="mt-4 rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Enregistrer la configuration
          </button>
        </section>
      ) : null}

      {activeTab === "bans" ? (
        <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
          <div className="mb-4 text-lg font-semibold text-slate-100">
            Ban par Discord ID
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={banDiscordId}
              onChange={(e) => setBanDiscordId(e.target.value)}
              placeholder="Discord ID"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason (optional)"
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!banDiscordId.trim()) {
                toast.error("discordId is required");
                return;
              }
              banMutation.mutate();
            }}
            disabled={banMutation.isPending}
            className="mt-4 rounded bg-rose-700 px-4 py-2 text-sm text-white hover:bg-rose-600 disabled:opacity-50"
          >
            Ban cet utilisateur Discord
          </button>

          <div className="mt-4 space-y-2">
            {bans.map((ban) => (
              <div
                key={ban.discordId}
                className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-100">
                    {ban.discordId}
                  </div>
                  <div className="text-xs text-slate-400">
                    {ban.reason ?? "No reason"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => unbanMutation.mutate(ban.discordId)}
                  disabled={unbanMutation.isPending}
                  className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                >
                  Unban
                </button>
              </div>
            ))}
            {bans.length === 0 ? (
              <div className="text-sm text-slate-400">No banned users.</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
