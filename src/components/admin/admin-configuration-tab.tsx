"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPencil, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AdminConfiguration,
  AdminGuild,
} from "@/components/admin/admin-types";
import { queryPresets } from "@/lib/query-presets";
import { apiFetch } from "@/lib/http-client";
import { parseIdListFromString } from "@/lib/config-lists";

type AdminGuildRolesResponse = {
  roles: Array<{
    id: string;
    name: string;
    position: number;
  }>;
  rolesError: string | null;
};

async function fetchAdminGuildRoles(
  guildId: string,
): Promise<AdminGuildRolesResponse> {
  return apiFetch<AdminGuildRolesResponse>(
    `/api/admin/global?type=guild-roles&guildId=${encodeURIComponent(guildId)}`,
    { method: "GET" },
    "Unable to load roles",
  );
}

type Props = {
  guilds: AdminGuild[];
  configurations: AdminConfiguration[];
};

type EditableFieldKey =
  | "apiKey"
  | "channelIds"
  | "enableSecondRoster"
  | "zooMemberRoleIds"
  | "warsCount"
  | "racesCount"
  | "invasionsCount"
  | "vodsCount"
  | "reviewsCount"
  | "bonusCount";

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return "*".repeat(key.length);
  return key.slice(0, 8) + "..." + key.slice(-4);
}

function EditButtons({
  isEditing,
  isPending,
  onSave,
  onCancel,
  onEdit,
}: {
  isEditing: boolean;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  if (isEditing) {
    return (
      <>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-emerald-500/60 px-1.5 py-1 text-emerald-400/70 disabled:opacity-40"
          onClick={onSave}
          disabled={isPending}
          aria-label="Confirm"
        >
          {isPending ? (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-300"
              aria-hidden="true"
            />
          ) : (
            <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
          )}
        </button>
        <button
          type="button"
          className="rounded-md border border-rose-500/60 px-1.5 py-1 text-rose-400/70 disabled:opacity-40"
          onClick={onCancel}
          disabled={isPending}
          aria-label="Cancel"
        >
          <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
        </button>
      </>
    );
  }
  return (
    <button
      type="button"
      className="rounded-md border border-slate-700/60 px-1.5 py-1 text-slate-500 transition-colors hover:text-slate-300"
      onClick={onEdit}
      aria-label="Edit"
    >
      <FontAwesomeIcon icon={faPencil} className="h-2.5 w-2.5" />
    </button>
  );
}

export function AdminConfigurationTab({ guilds, configurations }: Props) {
  const queryClient = useQueryClient();
  const [configGuildId, setConfigGuildId] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [channelIdsInput, setChannelIdsInput] = useState("");
  const [enableSecondRoster, setEnableSecondRoster] = useState(false);
  const [zooMemberRoleIds, setZooMemberRoleIds] = useState<string[]>([]);
  const [roleToAdd, setRoleToAdd] = useState("");
  const [warsCount, setWarsCount] = useState("0");
  const [racesCount, setRacesCount] = useState("0");
  const [invasionsCount, setInvasionsCount] = useState("0");
  const [vodsCount, setVodsCount] = useState("0");
  const [reviewsCount, setReviewsCount] = useState("0");
  const [bonusCount, setBonusCount] = useState("0");
  const [editingField, setEditingField] = useState<EditableFieldKey | null>(
    null,
  );
  const [pendingField, setPendingField] = useState<EditableFieldKey | null>(
    null,
  );

  const selectedGuildExists = guilds.some(
    (guild) => guild.discordGuildId === configGuildId,
  );
  const resolvedConfigGuildId = selectedGuildExists
    ? configGuildId
    : (guilds[0]?.discordGuildId ?? "");

  const selectedConfig = configurations.find(
    (item) => item.discordGuildId === resolvedConfigGuildId,
  );

  const rolesQuery = useQuery({
    queryKey: ["admin-global-guild-roles", resolvedConfigGuildId],
    queryFn: () => fetchAdminGuildRoles(resolvedConfigGuildId),
    enabled: Boolean(resolvedConfigGuildId),
    ...queryPresets.mediumLived,
  });

  function resolveChannelIds(config: AdminConfiguration | undefined) {
    if (!config) {
      return [];
    }

    if (Array.isArray(config.channelIds) && config.channelIds.length > 0) {
      return config.channelIds;
    }

    return parseIdListFromString(config.channelId);
  }

  function resolveRoleIds(config: AdminConfiguration | undefined) {
    if (!config) {
      return [];
    }

    if (
      Array.isArray(config.zooMemberRoleIds) &&
      config.zooMemberRoleIds.length > 0
    ) {
      return config.zooMemberRoleIds;
    }

    return parseIdListFromString(config.zooMemberRoleId);
  }

  useEffect(() => {
    setApiKey(selectedConfig?.apiKey ?? "");
    setChannelIdsInput(resolveChannelIds(selectedConfig).join(", "));
    setEnableSecondRoster(selectedConfig?.enableSecondRoster ?? false);
    setZooMemberRoleIds(resolveRoleIds(selectedConfig));
    setRoleToAdd("");
    setWarsCount(String(selectedConfig?.warsCount ?? 0));
    setRacesCount(String(selectedConfig?.racesCount ?? 0));
    setInvasionsCount(String(selectedConfig?.invasionsCount ?? 0));
    setVodsCount(String(selectedConfig?.vodsCount ?? 0));
    setReviewsCount(String(selectedConfig?.reviewsCount ?? 0));
    setBonusCount(String(selectedConfig?.bonusCount ?? 0));
    setEditingField(null);
  }, [resolvedConfigGuildId, selectedConfig]);

  const configMutation = useMutation({
    mutationFn: async (payload: {
      guildId: string;
      apiKey: string;
      channelIds: string[];
      enableSecondRoster: boolean;
      zooMemberRoleIds: string[];
      warsCount: number;
      racesCount: number;
      invasionsCount: number;
      vodsCount: number;
      reviewsCount: number;
      bonusCount: number;
    }) => {
      return apiFetch<unknown>(
        "/api/admin/global",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "set-config", ...payload }),
        },
        "Unable to save configuration",
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-global"] });
      toast.success("Configuration updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const roles = rolesQuery.data?.roles ?? [];
  const rolesError = rolesQuery.data?.rolesError;
  const savedRoleNames = selectedConfig?.zooMemberRoleNames ?? [];
  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const selectedRoleItems = zooMemberRoleIds.map((roleId, index) => ({
    id: roleId,
    name: roleById.get(roleId) ?? savedRoleNames[index] ?? roleId,
    missing: !roleById.has(roleId),
  }));
  const addableRoles = roles.filter(
    (role) => !zooMemberRoleIds.includes(role.id),
  );

  function handleAddRole() {
    if (!roleToAdd) {
      return;
    }

    setZooMemberRoleIds((previous) =>
      previous.includes(roleToAdd) ? previous : [...previous, roleToAdd],
    );
    setRoleToAdd("");
  }

  function handleRemoveRole(roleId: string) {
    setZooMemberRoleIds((previous) =>
      previous.filter((currentRoleId) => currentRoleId !== roleId),
    );
  }

  function resetField(field: EditableFieldKey) {
    if (field === "apiKey") {
      setApiKey(selectedConfig?.apiKey ?? "");
      return;
    }
    if (field === "channelIds") {
      setChannelIdsInput(resolveChannelIds(selectedConfig).join(", "));
      return;
    }
    if (field === "enableSecondRoster") {
      setEnableSecondRoster(selectedConfig?.enableSecondRoster ?? false);
      return;
    }
    if (field === "zooMemberRoleIds") {
      setZooMemberRoleIds(resolveRoleIds(selectedConfig));
      return;
    }
    if (field === "warsCount") {
      setWarsCount(String(selectedConfig?.warsCount ?? 0));
      return;
    }
    if (field === "racesCount") {
      setRacesCount(String(selectedConfig?.racesCount ?? 0));
      return;
    }
    if (field === "invasionsCount") {
      setInvasionsCount(String(selectedConfig?.invasionsCount ?? 0));
      return;
    }
    if (field === "vodsCount") {
      setVodsCount(String(selectedConfig?.vodsCount ?? 0));
      return;
    }
    if (field === "reviewsCount") {
      setReviewsCount(String(selectedConfig?.reviewsCount ?? 0));
      return;
    }
    setBonusCount(String(selectedConfig?.bonusCount ?? 0));
  }

  async function saveField(field: EditableFieldKey) {
    if (!resolvedConfigGuildId) {
      toast.error("Select a server first");
      return;
    }

    const parseCount = (value: string, label: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${label} must be an integer >= 0`);
      }
      return parsed;
    };

    let parsedWars = selectedConfig?.warsCount ?? 0;
    let parsedRaces = selectedConfig?.racesCount ?? 0;
    let parsedInvasions = selectedConfig?.invasionsCount ?? 0;
    let parsedVods = selectedConfig?.vodsCount ?? 0;
    let parsedReviews = selectedConfig?.reviewsCount ?? 0;
    let parsedBonus = selectedConfig?.bonusCount ?? 0;

    try {
      if (field === "warsCount")
        parsedWars = parseCount(warsCount, "War points");
      else if (field === "racesCount")
        parsedRaces = parseCount(racesCount, "Race points");
      else if (field === "invasionsCount")
        parsedInvasions = parseCount(invasionsCount, "Invasion points");
      else if (field === "vodsCount")
        parsedVods = parseCount(vodsCount, "Management points");
      else if (field === "reviewsCount")
        parsedReviews = parseCount(reviewsCount, "Review points");
      else if (field === "bonusCount")
        parsedBonus = parseCount(bonusCount, "Bonus points");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid value");
      return;
    }

    try {
      setPendingField(field);
      await configMutation.mutateAsync({
        guildId: resolvedConfigGuildId,
        apiKey,
        channelIds: parseIdListFromString(channelIdsInput),
        enableSecondRoster,
        zooMemberRoleIds,
        warsCount: parsedWars,
        racesCount: parsedRaces,
        invasionsCount: parsedInvasions,
        vodsCount: parsedVods,
        reviewsCount: parsedReviews,
        bonusCount: parsedBonus,
      });
      setEditingField(null);
    } catch {
      // error handled by onError
    } finally {
      setPendingField(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4 sm:p-6">
      <div className="mb-4 text-lg font-semibold text-slate-100">
        Configuration serveur
      </div>

      <div className="mb-6">
        <label
          htmlFor="admin-cfg-guild"
          className="mb-2 block text-sm font-medium text-slate-300"
        >
          Serveur
        </label>
        <select
          id="admin-cfg-guild"
          value={resolvedConfigGuildId}
          onChange={(e) => setConfigGuildId(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        >
          <option value="">Selectionner un serveur</option>
          {guilds.map((guild) => (
            <option key={guild.discordGuildId} value={guild.discordGuildId}>
              {guild.name ?? guild.discordGuildId}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="admin-cfg-apiKey"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            API key
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-apiKey"
              value={editingField === "apiKey" ? apiKey : maskApiKey(apiKey)}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ex: sk_live_xxx"
              disabled={editingField !== "apiKey" || pendingField === "apiKey"}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "apiKey"}
              isPending={pendingField === "apiKey"}
              onSave={() => {
                void saveField("apiKey");
              }}
              onCancel={() => {
                resetField("apiKey");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("apiKey")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-channelId"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Discord Channel IDs
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-channelId"
              value={channelIdsInput}
              onChange={(e) => setChannelIdsInput(e.target.value)}
              placeholder="ex: 123456789012345678, 987654321098765432"
              disabled={
                editingField !== "channelIds" || pendingField === "channelIds"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "channelIds"}
              isPending={pendingField === "channelIds"}
              onSave={() => {
                void saveField("channelIds");
              }}
              onCancel={() => {
                resetField("channelIds");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("channelIds")}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Separate channel IDs with commas.
          </p>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-enableSecondRoster"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Activer roster 2
          </label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="admin-cfg-enableSecondRoster"
              className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              <span>Afficher roster 2 sur la page roster</span>
              <input
                id="admin-cfg-enableSecondRoster"
                type="checkbox"
                checked={enableSecondRoster}
                onChange={(e) => setEnableSecondRoster(e.target.checked)}
                disabled={
                  editingField !== "enableSecondRoster" ||
                  pendingField === "enableSecondRoster"
                }
                className="h-4 w-4 accent-sky-500"
              />
            </label>
            <EditButtons
              isEditing={editingField === "enableSecondRoster"}
              isPending={pendingField === "enableSecondRoster"}
              onSave={() => {
                void saveField("enableSecondRoster");
              }}
              onCancel={() => {
                resetField("enableSecondRoster");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("enableSecondRoster")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-zooMemberRoleId"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Member roles
          </label>
          <div className="space-y-2">
            <div className="min-h-12 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2">
              {selectedRoleItems.length === 0 ? (
                <p className="px-1 py-1 text-xs text-slate-500">
                  No role selected.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedRoleItems.map((role) => (
                    <span
                      key={role.id}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        role.missing
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                          : "border-sky-500/50 bg-sky-500/10 text-sky-200"
                      }`}
                    >
                      <span>{role.name}</span>
                      {editingField === "zooMemberRoleIds" &&
                      pendingField !== "zooMemberRoleIds" ? (
                        <button
                          type="button"
                          className="-mr-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                          onClick={() => handleRemoveRole(role.id)}
                          aria-label={`Remove role ${role.name}`}
                        >
                          <FontAwesomeIcon
                            icon={faXmark}
                            className="h-2.5 w-2.5"
                          />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                id="admin-cfg-zooMemberRoleId"
                value={roleToAdd}
                onChange={(event) => setRoleToAdd(event.target.value)}
                disabled={
                  editingField !== "zooMemberRoleIds" ||
                  pendingField === "zooMemberRoleIds" ||
                  rolesQuery.isLoading
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
              >
                <option value="">-- Select a role to add --</option>
                {addableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddRole}
                disabled={
                  editingField !== "zooMemberRoleIds" ||
                  pendingField === "zooMemberRoleIds" ||
                  rolesQuery.isLoading ||
                  !roleToAdd
                }
                className="rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-500 hover:text-sky-200 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <EditButtons
              isEditing={editingField === "zooMemberRoleIds"}
              isPending={pendingField === "zooMemberRoleIds"}
              onSave={() => {
                void saveField("zooMemberRoleIds");
              }}
              onCancel={() => {
                resetField("zooMemberRoleIds");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("zooMemberRoleIds")}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Add roles one by one. Click × on a tag to remove it.
          </p>
          {selectedRoleItems.some((role) => role.missing) ? (
            <p className="mt-2 text-xs text-amber-300">
              Some saved roles are missing from this server.
            </p>
          ) : null}
          {rolesError ? (
            <p className="mt-2 text-xs text-amber-300">{rolesError}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="admin-cfg-warsCount"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Points par War
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-warsCount"
              type="number"
              min={0}
              step={1}
              value={warsCount}
              onChange={(e) => setWarsCount(e.target.value)}
              disabled={
                editingField !== "warsCount" || pendingField === "warsCount"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "warsCount"}
              isPending={pendingField === "warsCount"}
              onSave={() => {
                void saveField("warsCount");
              }}
              onCancel={() => {
                resetField("warsCount");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("warsCount")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-racesCount"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Points par Race
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-racesCount"
              type="number"
              min={0}
              step={1}
              value={racesCount}
              onChange={(e) => setRacesCount(e.target.value)}
              disabled={
                editingField !== "racesCount" || pendingField === "racesCount"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "racesCount"}
              isPending={pendingField === "racesCount"}
              onSave={() => {
                void saveField("racesCount");
              }}
              onCancel={() => {
                resetField("racesCount");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("racesCount")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-invasionsCount"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Points par Invasion
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-invasionsCount"
              type="number"
              min={0}
              step={1}
              value={invasionsCount}
              onChange={(e) => setInvasionsCount(e.target.value)}
              disabled={
                editingField !== "invasionsCount" ||
                pendingField === "invasionsCount"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "invasionsCount"}
              isPending={pendingField === "invasionsCount"}
              onSave={() => {
                void saveField("invasionsCount");
              }}
              onCancel={() => {
                resetField("invasionsCount");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("invasionsCount")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-vodsCount"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Points par Management
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-vodsCount"
              type="number"
              min={0}
              step={1}
              value={vodsCount}
              onChange={(e) => setVodsCount(e.target.value)}
              disabled={
                editingField !== "vodsCount" || pendingField === "vodsCount"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "vodsCount"}
              isPending={pendingField === "vodsCount"}
              onSave={() => {
                void saveField("vodsCount");
              }}
              onCancel={() => {
                resetField("vodsCount");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("vodsCount")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-reviewsCount"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Points par Review
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-reviewsCount"
              type="number"
              min={0}
              step={1}
              value={reviewsCount}
              onChange={(e) => setReviewsCount(e.target.value)}
              disabled={
                editingField !== "reviewsCount" ||
                pendingField === "reviewsCount"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "reviewsCount"}
              isPending={pendingField === "reviewsCount"}
              onSave={() => {
                void saveField("reviewsCount");
              }}
              onCancel={() => {
                resetField("reviewsCount");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("reviewsCount")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-cfg-bonusCount"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Points par Bonus
          </label>
          <div className="flex items-center gap-2">
            <input
              id="admin-cfg-bonusCount"
              type="number"
              min={0}
              step={1}
              value={bonusCount}
              onChange={(e) => setBonusCount(e.target.value)}
              disabled={
                editingField !== "bonusCount" || pendingField === "bonusCount"
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
            />
            <EditButtons
              isEditing={editingField === "bonusCount"}
              isPending={pendingField === "bonusCount"}
              onSave={() => {
                void saveField("bonusCount");
              }}
              onCancel={() => {
                resetField("bonusCount");
                setEditingField(null);
              }}
              onEdit={() => setEditingField("bonusCount")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
