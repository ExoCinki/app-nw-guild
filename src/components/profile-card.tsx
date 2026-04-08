"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  InlineLoadingIndicator,
  LoadingIndicator,
} from "@/components/loading-indicator";

type MeResponse = {
  user: {
    id: string;
    displayName: string | null;
    discordId: string | null;
    email: string | null;
    image: string | null;
  };
};

type WhitelistedGuildsResponse = {
  guilds: Array<{
    id: string;
    name: string | null;
  }>;
};

type SelectedGuildResponse = {
  selectedGuildId: string | null;
};

async function getMe(): Promise<MeResponse> {
  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Unable to load profile.");
  }

  return response.json() as Promise<MeResponse>;
}

async function getWhitelistedGuilds(): Promise<WhitelistedGuildsResponse> {
  const response = await fetch("/api/guilds/whitelisted", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Unable to load servers.");
  }

  return response.json() as Promise<WhitelistedGuildsResponse>;
}

async function getSelectedGuild(): Promise<SelectedGuildResponse> {
  const response = await fetch("/api/selected-guild", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    return { selectedGuildId: null };
  }

  return response.json() as Promise<SelectedGuildResponse>;
}

async function setSelectedGuild(guildId: string): Promise<void> {
  const response = await fetch("/api/selected-guild", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Unable to save selection.");
  }
}

export function ProfileCard() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [manualSelectedGuildId, setManualSelectedGuildId] =
    useState<string>("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: status === "authenticated",
  });

  const whitelistedGuildsQuery = useQuery({
    queryKey: ["guilds", "whitelisted"],
    queryFn: getWhitelistedGuilds,
    enabled: status === "authenticated",
  });

  const selectedGuildQuery = useQuery({
    queryKey: ["selected-guild"],
    queryFn: getSelectedGuild,
    enabled: status === "authenticated",
  });

  const selectGuildMutation = useMutation({
    mutationFn: setSelectedGuild,
    onSuccess: async () => {
      toast.success("Server selected.");
      await queryClient.invalidateQueries({ queryKey: ["selected-guild"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Unknown API error.";
      toast.error(message);
    },
  });

  const isConnected = status === "authenticated";
  const user = meQuery.data?.user;
  const guilds = useMemo(
    () => whitelistedGuildsQuery.data?.guilds ?? [],
    [whitelistedGuildsQuery.data?.guilds],
  );
  const persistedGuildId = selectedGuildQuery.data?.selectedGuildId ?? "";
  const hasPersistedGuild =
    Boolean(persistedGuildId) &&
    guilds.some((guild) => guild.id === persistedGuildId);
  const hasManualGuild =
    Boolean(manualSelectedGuildId) &&
    guilds.some((guild) => guild.id === manualSelectedGuildId);
  const selectedGuildId =
    guilds.length === 0
      ? ""
      : hasManualGuild
        ? manualSelectedGuildId
        : hasPersistedGuild
          ? persistedGuildId
          : guilds.length === 1
            ? guilds[0].id
            : "";

  useEffect(() => {
    if (meQuery.isError) {
      const message =
        meQuery.error instanceof Error
          ? meQuery.error.message
          : "Unknown API error.";
      toast.error(message);
    }
  }, [meQuery.error, meQuery.isError]);

  useEffect(() => {
    if (whitelistedGuildsQuery.isError) {
      const message =
        whitelistedGuildsQuery.error instanceof Error
          ? whitelistedGuildsQuery.error.message
          : "Unknown API error.";
      toast.error(message);
    }
  }, [whitelistedGuildsQuery.error, whitelistedGuildsQuery.isError]);

  useEffect(() => {
    if (guilds.length === 1) {
      const onlyGuildId = guilds[0].id;
      if (persistedGuildId !== onlyGuildId && !selectGuildMutation.isPending) {
        selectGuildMutation.mutate(onlyGuildId);
      }
    }
  }, [guilds, persistedGuildId, selectGuildMutation]);

  const selectedGuild = guilds.find((guild) => guild.id === selectedGuildId);

  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
      <h1 className="text-2xl font-semibold text-slate-100">My Profile</h1>

      <div className="mt-6">
        {status === "loading" ? (
          <LoadingIndicator compact />
        ) : !isConnected ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
            onClick={async () => {
              toast.info("Redirecting to Discord...");
              await signIn("discord");
            }}
          >
            Sign in with Discord
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-slate-800 p-3">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt="User avatar"
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-slate-700" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {user?.displayName ?? session?.user?.displayName ?? "User"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {user?.email ?? session?.user?.email}
                </p>
              </div>
            </div>

            {meQuery.isLoading ? <InlineLoadingIndicator /> : null}

            {meQuery.isError ? (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                Unable to load profile. Try again in a few seconds.
              </div>
            ) : null}

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md border border-slate-700 px-3 py-2">
                <dt className="text-slate-400">Display Name</dt>
                <dd className="font-medium text-slate-100">
                  {user?.displayName ?? "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-700 px-3 py-2">
                <dt className="text-slate-400">Discord ID</dt>
                <dd className="font-medium text-slate-100">
                  {user?.discordId ?? "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-700 px-3 py-2">
                <dt className="text-emerald-400">Selected server</dt>
                <dd className="font-medium text-emerald-300">
                  {selectedGuild?.name || selectedGuild?.id || "-"}
                </dd>
              </div>
            </dl>

            {whitelistedGuildsQuery.isLoading ||
            (whitelistedGuildsQuery.data?.guilds &&
              (whitelistedGuildsQuery.data.guilds.length ?? 0) > 1) ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                  Server to manage
                </label>
                {whitelistedGuildsQuery.isLoading ? (
                  <InlineLoadingIndicator />
                ) : (
                  <select
                    value={selectedGuildId}
                    onChange={(e) => {
                      setManualSelectedGuildId(e.target.value);
                      if (e.target.value) {
                        selectGuildMutation.mutate(e.target.value);
                      }
                    }}
                    disabled={selectGuildMutation.isPending}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-50"
                  >
                    <option value="">-- Select a server --</option>
                    {whitelistedGuildsQuery.data?.guilds.map((guild) => (
                      <option key={guild.id} value={guild.id}>
                        {guild.name || guild.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}

            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              onClick={async () => {
                toast.success("Signing out...");
                await signOut({ callbackUrl: "/" });
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
