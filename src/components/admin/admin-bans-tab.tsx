"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AdminBan, AdminUser } from "@/components/admin/admin-types";

type Props = {
  users: AdminUser[];
  bans: AdminBan[];
};

export function AdminBansTab({ users, bans }: Props) {
  const queryClient = useQueryClient();
  const [banDiscordId, setBanDiscordId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banUserSearch, setBanUserSearch] = useState("");

  const filteredForSearch = banUserSearch.trim()
    ? users.filter((user) => {
        const q = banUserSearch.trim().toLowerCase();
        const label =
          `${user.displayName ?? ""} ${user.name ?? ""} ${user.email ?? ""} ${user.discordId ?? ""}`.toLowerCase();
        return label.includes(q);
      })
    : [];

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
        { method: "DELETE", credentials: "include" },
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

  return (
    <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
      <div className="mb-4 text-lg font-semibold text-slate-100">
        Ban par Discord ID
      </div>

      <div className="mb-4">
        <div className="mb-2 text-sm font-medium text-slate-300">
          Rechercher un utilisateur connecté
        </div>
        <input
          type="text"
          value={banUserSearch}
          onChange={(e) => setBanUserSearch(e.target.value)}
          placeholder="Nom, Discord ID, email..."
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
        {banUserSearch.trim() ? (
          <div className="mt-1 max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-900">
            {filteredForSearch.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setBanDiscordId(user.discordId ?? "");
                  setBanUserSearch("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800"
              >
                <span className="font-medium text-slate-100">
                  {user.displayName ?? user.name ?? user.email ?? "Unknown"}
                </span>
                <span className="ml-2 shrink-0 text-xs text-slate-400">
                  {user.discordId ?? "no discordId"}
                </span>
              </button>
            ))}
            {filteredForSearch.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">
                No user found.
              </div>
            ) : null}
          </div>
        ) : null}
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
              <div className="font-medium text-slate-100">{ban.discordId}</div>
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
  );
}
