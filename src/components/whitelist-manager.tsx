"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { InlineLoadingIndicator } from "@/components/loading-indicator";

type WhitelistGuild = {
  discordGuildId: string;
  name: string | null;
  createdAt: string;
};

type WhitelistResponse = {
  guilds: WhitelistGuild[];
};

async function getWhitelist(): Promise<WhitelistResponse> {
  const response = await fetch("/api/whitelist", {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 403) {
    return { guilds: [] };
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Unable to load whitelist.");
  }

  return response.json() as Promise<WhitelistResponse>;
}

async function addWhitelistGuild(payload: { guildId: string; name?: string }) {
  const response = await fetch("/api/whitelist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorPayload?.error ?? "Unable to add whitelist entry.");
  }
}

async function removeWhitelistGuild(guildId: string) {
  const response = await fetch(
    `/api/whitelist?guildId=${encodeURIComponent(guildId)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorPayload?.error ?? "Unable to remove whitelist entry.");
  }
}

export function WhitelistManager() {
  const queryClient = useQueryClient();
  const [guildIdInput, setGuildIdInput] = useState<string>("");
  const [guildNameInput, setGuildNameInput] = useState<string>("");

  const whitelistQuery = useQuery({
    queryKey: ["whitelist"],
    queryFn: getWhitelist,
    retry: false,
  });

  const addWhitelistMutation = useMutation({
    mutationFn: addWhitelistGuild,
    onSuccess: async () => {
      toast.success("Server added to whitelist.");
      setGuildIdInput("");
      setGuildNameInput("");
      await queryClient.invalidateQueries({ queryKey: ["whitelist"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Unknown API error.";
      toast.error(message);
    },
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: removeWhitelistGuild,
    onSuccess: async () => {
      toast.success("Server removed from whitelist.");
      await queryClient.invalidateQueries({ queryKey: ["whitelist"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Unknown API error.";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-100">
          Whitelist management
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Add or remove authorized servers.
        </p>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Discord Server ID
              </label>
              <input
                value={guildIdInput}
                onChange={(event) => setGuildIdInput(event.target.value)}
                placeholder="ex: 123456789012345678"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Name (optional)
              </label>
              <input
                value={guildNameInput}
                onChange={(event) => setGuildNameInput(event.target.value)}
                placeholder="ex: My great server"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            disabled={!guildIdInput.trim() || addWhitelistMutation.isPending}
            onClick={() => {
              addWhitelistMutation.mutate({
                guildId: guildIdInput.trim(),
                name: guildNameInput.trim() || undefined,
              });
            }}
          >
            Add to whitelist
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
        <h3 className="text-lg font-semibold text-slate-100">
          Whitelisted servers
        </h3>

        <div className="mt-4 space-y-2">
          {whitelistQuery.isLoading ? <InlineLoadingIndicator /> : null}

          {(whitelistQuery.data?.guilds.length ?? 0) === 0 &&
          !whitelistQuery.isLoading ? (
            <p className="text-sm text-slate-400">No whitelisted server.</p>
          ) : null}

          {whitelistQuery.data?.guilds.map((guild) => (
            <div
              key={guild.discordGuildId}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {guild.name || guild.discordGuildId}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {guild.discordGuildId}
                </p>
              </div>
              <button
                type="button"
                className="ml-2 rounded-md border border-rose-500 px-3 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
                onClick={() => {
                  removeWhitelistMutation.mutate(guild.discordGuildId);
                }}
                disabled={removeWhitelistMutation.isPending}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
