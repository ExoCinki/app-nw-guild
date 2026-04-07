"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AdminConfiguration,
  AdminGuild,
} from "@/components/admin/admin-types";

type Props = {
  guilds: AdminGuild[];
  configurations: AdminConfiguration[];
};

export function AdminConfigurationTab({ guilds, configurations }: Props) {
  const queryClient = useQueryClient();
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

  function applyConfigPreset(nextGuildId: string) {
    const config = configurations.find(
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

  return (
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
  );
}
