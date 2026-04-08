"use client";

import { useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [configGuildId, setConfigGuildId] = useState("");

  const selectedGuildExists = guilds.some(
    (guild) => guild.discordGuildId === configGuildId,
  );
  const resolvedConfigGuildId = selectedGuildExists
    ? configGuildId
    : (guilds[0]?.discordGuildId ?? "");

  const selectedConfig = configurations.find(
    (item) => item.discordGuildId === resolvedConfigGuildId,
  );

  const configMutation = useMutation({
    mutationFn: async (payload: {
      guildId: string;
      channelId: string;
      apiKey: string;
      zooMemberRoleId: string;
      zooMemberRoleName: string;
      warsCount: string;
      racesCount: string;
      invasionsCount: string;
      vodsCount: string;
      reviewsCount: string;
      bonusCount: string;
    }) => {
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
          guildId: payload.guildId,
          channelId: payload.channelId,
          apiKey: payload.apiKey,
          zooMemberRoleId: payload.zooMemberRoleId,
          zooMemberRoleName: payload.zooMemberRoleName,
          warsCount: parseIntField(payload.warsCount, "warsCount"),
          racesCount: parseIntField(payload.racesCount, "racesCount"),
          invasionsCount: parseIntField(
            payload.invasionsCount,
            "invasionsCount",
          ),
          vodsCount: parseIntField(payload.vodsCount, "vodsCount"),
          reviewsCount: parseIntField(payload.reviewsCount, "reviewsCount"),
          bonusCount: parseIntField(payload.bonusCount, "bonusCount"),
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
        value={resolvedConfigGuildId}
        onChange={(e) => {
          setConfigGuildId(e.target.value);
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

      <form
        ref={formRef}
        key={resolvedConfigGuildId}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div>
          <label
            htmlFor="cfg-apiKey"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            API key
          </label>
          <input
            id="cfg-apiKey"
            name="apiKey"
            defaultValue={selectedConfig?.apiKey ?? ""}
            placeholder="ex: sk_live_xxx"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-channelId"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Channel ID
          </label>
          <input
            id="cfg-channelId"
            name="channelId"
            defaultValue={selectedConfig?.channelId ?? ""}
            placeholder="ex: 123456789012345678"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-zooMemberRoleId"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Zoo role ID
          </label>
          <input
            id="cfg-zooMemberRoleId"
            name="zooMemberRoleId"
            defaultValue={selectedConfig?.zooMemberRoleId ?? ""}
            placeholder="ex: 123456789012345678"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-zooMemberRoleName"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Zoo role name
          </label>
          <input
            id="cfg-zooMemberRoleName"
            name="zooMemberRoleName"
            defaultValue={selectedConfig?.zooMemberRoleName ?? ""}
            placeholder="ex: ZOO 2.0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-warsCount"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Points par War
          </label>
          <input
            id="cfg-warsCount"
            name="warsCount"
            defaultValue={String(selectedConfig?.warsCount ?? 0)}
            placeholder="0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-racesCount"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Points par Race
          </label>
          <input
            id="cfg-racesCount"
            name="racesCount"
            defaultValue={String(selectedConfig?.racesCount ?? 0)}
            placeholder="0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-invasionsCount"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Points par Invasion
          </label>
          <input
            id="cfg-invasionsCount"
            name="invasionsCount"
            defaultValue={String(selectedConfig?.invasionsCount ?? 0)}
            placeholder="0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-vodsCount"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Points par VOD
          </label>
          <input
            id="cfg-vodsCount"
            name="vodsCount"
            defaultValue={String(selectedConfig?.vodsCount ?? 0)}
            placeholder="0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-reviewsCount"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Points par Review
          </label>
          <input
            id="cfg-reviewsCount"
            name="reviewsCount"
            defaultValue={String(selectedConfig?.reviewsCount ?? 0)}
            placeholder="0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="cfg-bonusCount"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Points par Bonus
          </label>
          <input
            id="cfg-bonusCount"
            name="bonusCount"
            defaultValue={String(selectedConfig?.bonusCount ?? 0)}
            placeholder="0"
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </form>

      <button
        type="button"
        onClick={() => {
          if (!resolvedConfigGuildId) {
            toast.error("Select a server first");
            return;
          }

          const currentForm = formRef.current;
          if (!currentForm) {
            toast.error("Configuration form unavailable");
            return;
          }

          const formData = new FormData(currentForm);
          configMutation.mutate({
            guildId: resolvedConfigGuildId,
            apiKey: String(formData.get("apiKey") ?? ""),
            channelId: String(formData.get("channelId") ?? ""),
            zooMemberRoleId: String(formData.get("zooMemberRoleId") ?? ""),
            zooMemberRoleName: String(formData.get("zooMemberRoleName") ?? ""),
            warsCount: String(formData.get("warsCount") ?? "0"),
            racesCount: String(formData.get("racesCount") ?? "0"),
            invasionsCount: String(formData.get("invasionsCount") ?? "0"),
            vodsCount: String(formData.get("vodsCount") ?? "0"),
            reviewsCount: String(formData.get("reviewsCount") ?? "0"),
            bonusCount: String(formData.get("bonusCount") ?? "0"),
          });
        }}
        disabled={configMutation.isPending}
        className="mt-4 rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        Enregistrer la configuration
      </button>
    </section>
  );
}
