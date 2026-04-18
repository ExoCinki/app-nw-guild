"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AdminGuild, AdminUser } from "@/components/admin/admin-types";

type Props = {
  users: AdminUser[];
  guilds: AdminGuild[];
};

export function AdminUsersTab({ users, guilds }: Props) {
  const queryClient = useQueryClient();
  const [managedUserId, setManagedUserId] = useState("");
  const [managedUserDisplayName, setManagedUserDisplayName] = useState("");
  const [managedUserSelectedGuildId, setManagedUserSelectedGuildId] =
    useState("");

  function loadManagedUser(userId: string) {
    const user = users.find((u) => u.id === userId);
    setManagedUserId(userId);
    setManagedUserDisplayName(user?.displayName ?? "");
    setManagedUserSelectedGuildId(user?.selectedGuild?.discordGuildId ?? "");
  }

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

  return (
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
          <option value="">Select a user</option>
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
          <option value="">No default server</option>
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
            toast.error("Select a user");
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
  );
}
