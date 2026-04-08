"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AdminGlobalAdmin,
  AdminUser,
} from "@/components/admin/admin-types";

type Props = {
  users: AdminUser[];
  globalAdmins: AdminGlobalAdmin[];
};

export function AdminGlobalAdminsTab({ users, globalAdmins }: Props) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const globalAdminUserIds = new Set(globalAdmins.map((admin) => admin.userId));

  const filteredUsers = users.filter((user) => {
    if (globalAdminUserIds.has(user.id)) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const label =
      `${user.displayName ?? ""} ${user.name ?? ""} ${user.email ?? ""} ${user.discordId ?? ""}`.toLowerCase();
    return label.includes(query);
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
      setSelectedUserId("");
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
    <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
      <div className="mb-3 text-lg font-semibold text-slate-100">
        Admins globaux
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Les admins globaux ont un accès complet en lecture et écriture à tous
        les modules sur tous les serveurs.
      </p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher un user..."
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Sélectionner un user</option>
          {filteredUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName ?? user.name ?? user.email ?? "Unknown"} -{" "}
              {user.discordId ?? "no discordId"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!selectedUserId) {
              toast.error("Sélectionner un user d'abord");
              return;
            }
            addMutation.mutate(selectedUserId);
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
            {globalAdmins.map((admin) => {
              const user = users.find((entry) => entry.id === admin.userId);
              return (
                <tr key={admin.userId} className="border-t border-slate-700/70">
                  <td className="px-3 py-2">
                    {user?.displayName ??
                      user?.name ??
                      user?.email ??
                      admin.userId}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {user?.discordId ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {new Date(admin.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(admin.userId)}
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
    </section>
  );
}
