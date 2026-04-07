"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AdminAccess,
  AdminGuild,
  AdminUser,
  AdminGlobalAdmin,
} from "@/components/admin/admin-types";

type GlobalAdminsSectionProps = {
  users: AdminUser[];
  globalAdmins: AdminGlobalAdmin[];
  globalAdminSearchQuery: string;
  setGlobalAdminSearchQuery: (v: string) => void;
  selectedGlobalAdminUserId: string;
  setSelectedGlobalAdminUserId: (v: string) => void;
};

function GlobalAdminsSection({
  users,
  globalAdmins,
  globalAdminSearchQuery,
  setGlobalAdminSearchQuery,
  selectedGlobalAdminUserId,
  setSelectedGlobalAdminUserId,
}: GlobalAdminsSectionProps) {
  const queryClient = useQueryClient();

  const globalAdminUserIds = new Set(globalAdmins.map((ga) => ga.userId));

  const filteredUsers = users.filter((user) => {
    if (globalAdminUserIds.has(user.id)) return false;
    const q = globalAdminSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const label =
      `${user.displayName ?? ""} ${user.name ?? ""} ${user.email ?? ""} ${user.discordId ?? ""}`.toLowerCase();
    return label.includes(q);
  });

  const addMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "add-global-admin", userId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to add global admin");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Admin global ajouté");
      setSelectedGlobalAdminUserId("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/admin/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "remove-global-admin", userId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to remove global admin");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Admin global retiré");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-8">
      <div className="mb-3 text-base font-semibold text-slate-100">
        Admins globaux
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Les admins globaux ont un accès complet (lecture + écriture) à tous les
        modules sur tous les serveurs.
      </p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={globalAdminSearchQuery}
          onChange={(e) => setGlobalAdminSearchQuery(e.target.value)}
          placeholder="Rechercher un user..."
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={selectedGlobalAdminUserId}
          onChange={(e) => setSelectedGlobalAdminUserId(e.target.value)}
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Sélectionner un user</option>
          {filteredUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName ?? user.name ?? user.email ?? "Unknown"} –{" "}
              {user.discordId ?? "no discordId"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!selectedGlobalAdminUserId) {
              toast.error("Sélectionner un user d'abord");
              return;
            }
            addMutation.mutate(selectedGlobalAdminUserId);
          }}
          disabled={addMutation.isPending}
          className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="min-w-full text-xs text-slate-200">
          <thead className="bg-slate-800/90 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Utilisateur</th>
              <th className="px-3 py-2 text-left">Discord ID</th>
              <th className="px-3 py-2 text-left">Ajouté le</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {globalAdmins.map((ga) => {
              const user = users.find((u) => u.id === ga.userId);
              return (
                <tr key={ga.userId} className="border-t border-slate-700/70">
                  <td className="px-3 py-2">
                    {user?.displayName ??
                      user?.name ??
                      user?.email ??
                      ga.userId}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {user?.discordId ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {new Date(ga.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(ga.userId)}
                      disabled={removeMutation.isPending}
                      className="rounded bg-red-800 px-2 py-1 hover:bg-red-700 disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              );
            })}
            {globalAdmins.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-400" colSpan={4}>
                  Aucun admin global configuré.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Props = {
  users: AdminUser[];
  guilds: AdminGuild[];
  accesses: AdminAccess[];
  globalAdmins: AdminGlobalAdmin[];
};

export function AdminAccessTab({
  users,
  guilds,
  accesses,
  globalAdmins,
}: Props) {
  const queryClient = useQueryClient();
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [canReadRoster, setCanReadRoster] = useState(true);
  const [canWriteRoster, setCanWriteRoster] = useState(true);
  const [canReadPayout, setCanReadPayout] = useState(true);
  const [canWritePayout, setCanWritePayout] = useState(true);
  const [canReadConfiguration, setCanReadConfiguration] = useState(true);
  const [canWriteConfiguration, setCanWriteConfiguration] = useState(true);
  const [canReadArchives, setCanReadArchives] = useState(true);
  const [canWriteArchives, setCanWriteArchives] = useState(true);
  const [globalAdminSearchQuery, setGlobalAdminSearchQuery] = useState("");
  const [selectedGlobalAdminUserId, setSelectedGlobalAdminUserId] =
    useState("");

  const userById = new Map(users.map((u) => [u.id, u]));
  const guildById = new Map(guilds.map((g) => [g.discordGuildId, g]));
  const globalAdminUserIds = new Set(globalAdmins.map((ga) => ga.userId));
  const usersWithScopedAccess = new Set(
    accesses
      .filter(
        (item) => !selectedGuildId || item.discordGuildId === selectedGuildId,
      )
      .map((item) => item.userId),
  );

  const filteredUsers = users.filter((user) => {
    if (globalAdminUserIds.has(user.id)) return false;
    if (usersWithScopedAccess.has(user.id)) return false;
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const label =
      `${user.displayName ?? ""} ${user.name ?? ""} ${user.email ?? ""} ${user.discordId ?? ""}`.toLowerCase();
    return label.includes(q);
  });

  function applyAccessPreset(nextUserId: string, nextGuildId: string) {
    const match = accesses.find(
      (item) =>
        item.userId === nextUserId && item.discordGuildId === nextGuildId,
    );
    setCanReadRoster(match?.canReadRoster ?? true);
    setCanWriteRoster(match?.canWriteRoster ?? true);
    setCanReadPayout(match?.canReadPayout ?? true);
    setCanWritePayout(match?.canWritePayout ?? true);
    setCanReadConfiguration(match?.canReadConfiguration ?? true);
    setCanWriteConfiguration(match?.canWriteConfiguration ?? true);
    setCanReadArchives(match?.canReadArchives ?? true);
    setCanWriteArchives(match?.canWriteArchives ?? true);
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
          canReadArchives,
          canWriteArchives,
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

  const formatPerm = (canRead: boolean, canWrite: boolean) => {
    if (!canRead) return "Aucun";
    return canWrite ? "Read/Write" : "Read";
  };

  return (
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
              setCanReadArchives(true);
              setCanWriteArchives(true);
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
              setCanReadArchives(true);
              setCanWriteArchives(false);
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
              setCanReadArchives(false);
              setCanWriteArchives(false);
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

          <div className="rounded border border-slate-700 bg-slate-800/60 p-2">
            <div className="mb-2 font-medium">Archives</div>
            <label className="mr-3 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={canReadArchives}
                onChange={(e) => {
                  setCanReadArchives(e.target.checked);
                  if (!e.target.checked) setCanWriteArchives(false);
                }}
              />
              Read
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={canWriteArchives}
                onChange={(e) => {
                  setCanWriteArchives(e.target.checked);
                  if (e.target.checked) setCanReadArchives(true);
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
                <th className="px-3 py-2 text-left">Archives</th>
                <th className="px-3 py-2 text-left">Regle explicite</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {accesses
                .filter((row) => !globalAdminUserIds.has(row.userId))
                .map((row) => {
                  const user = userById.get(row.userId);
                  const guild = guildById.get(row.discordGuildId);
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
                      <td className="px-3 py-2">
                        {formatPerm(row.canReadArchives, row.canWriteArchives)}
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
              {accesses.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-400" colSpan={8}>
                    Aucune regle explicite enregistree.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <GlobalAdminsSection
        users={users}
        globalAdmins={globalAdmins}
        globalAdminSearchQuery={globalAdminSearchQuery}
        setGlobalAdminSearchQuery={setGlobalAdminSearchQuery}
        selectedGlobalAdminUserId={selectedGlobalAdminUserId}
        setSelectedGlobalAdminUserId={setSelectedGlobalAdminUserId}
      />
    </section>
  );
}
