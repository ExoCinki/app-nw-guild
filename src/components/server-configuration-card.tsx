"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPencil, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { LoadingIndicator } from "@/components/loading-indicator";
import { parseIdListFromString } from "@/lib/config-lists";

type ServerConfigurationResponse = {
  guild: {
    id: string;
    name: string | null;
  };
  roles: Array<{
    id: string;
    name: string;
    position: number;
  }>;
  rolesError: string | null;
  configuration: {
    apiKey: string;
    channelId: string;
    channelIds: string[];
    enableSecondRoster: boolean;
    zooMemberRoleId: string;
    zooMemberRoleName: string;
    zooMemberRoleIds: string[];
    zooMemberRoleNames: string[];
    warsCount: number;
    racesCount: number;
    invasionsCount: number;
    vodsCount: number;
    reviewsCount: number;
    bonusCount: number;
    updatedAt: string | null;
  };
};

type SaveServerConfigurationPayload = {
  apiKey?: string;
  channelIds?: string[];
  enableSecondRoster?: boolean;
  zooMemberRoleIds?: string[];
  warsCount?: number;
  racesCount?: number;
  invasionsCount?: number;
  vodsCount?: number;
  reviewsCount?: number;
  bonusCount?: number;
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

async function getServerConfiguration(): Promise<ServerConfigurationResponse> {
  const response = await fetch("/api/server-configuration", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Unable to load configuration.");
  }

  return response.json() as Promise<ServerConfigurationResponse>;
}

async function saveServerConfiguration(
  payload: SaveServerConfigurationPayload,
) {
  const response = await fetch("/api/server-configuration", {
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
    throw new Error(errorPayload?.error ?? "Unable to save configuration.");
  }

  return response.json() as Promise<ServerConfigurationResponse>;
}

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
          className="rounded-md border border-emerald-500/60 px-1.5 py-1 text-emerald-400/70 disabled:opacity-40 inline-flex items-center justify-center"
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
      className="rounded-md border border-slate-700/60 px-1.5 py-1 text-slate-500 hover:text-slate-300 transition-colors"
      onClick={onEdit}
      aria-label="Edit"
    >
      <FontAwesomeIcon icon={faPencil} className="h-2.5 w-2.5" />
    </button>
  );
}

export function ServerConfigurationCard() {
  const queryClient = useQueryClient();
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

  const configurationQuery = useQuery({
    queryKey: ["server-configuration"],
    queryFn: getServerConfiguration,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const saveMutation = useMutation({
    mutationFn: saveServerConfiguration,
  });

  function resolveChannelIds(
    config: ServerConfigurationResponse["configuration"],
  ) {
    if (Array.isArray(config.channelIds) && config.channelIds.length > 0) {
      return config.channelIds;
    }

    return parseIdListFromString(config.channelId);
  }

  function resolveRoleIds(
    config: ServerConfigurationResponse["configuration"],
  ) {
    if (
      Array.isArray(config.zooMemberRoleIds) &&
      config.zooMemberRoleIds.length > 0
    ) {
      return config.zooMemberRoleIds;
    }

    return parseIdListFromString(config.zooMemberRoleId);
  }

  const syncFromConfigurationData = useCallback(
    (data: ServerConfigurationResponse) => {
      const channelIds =
        Array.isArray(data.configuration.channelIds) &&
        data.configuration.channelIds.length > 0
          ? data.configuration.channelIds
          : parseIdListFromString(data.configuration.channelId);
      const roleIds =
        Array.isArray(data.configuration.zooMemberRoleIds) &&
        data.configuration.zooMemberRoleIds.length > 0
          ? data.configuration.zooMemberRoleIds
          : parseIdListFromString(data.configuration.zooMemberRoleId);

      setApiKey(data.configuration.apiKey ?? "");
      setChannelIdsInput(channelIds.join(", "));
      setEnableSecondRoster(Boolean(data.configuration.enableSecondRoster));
      setZooMemberRoleIds(roleIds);
      setRoleToAdd("");
      setWarsCount(String(data.configuration.warsCount));
      setRacesCount(String(data.configuration.racesCount));
      setInvasionsCount(String(data.configuration.invasionsCount));
      setVodsCount(String(data.configuration.vodsCount));
      setReviewsCount(String(data.configuration.reviewsCount));
      setBonusCount(String(data.configuration.bonusCount));
    },
    [],
  );

  useEffect(() => {
    if (configurationQuery.data) {
      syncFromConfigurationData(configurationQuery.data);
    }
  }, [configurationQuery.data, syncFromConfigurationData]);

  function resetField(field: EditableFieldKey) {
    const config = configurationQuery.data?.configuration;
    if (!config) {
      return;
    }

    if (field === "apiKey") {
      setApiKey(config.apiKey ?? "");
      return;
    }
    if (field === "channelIds") {
      setChannelIdsInput(resolveChannelIds(config).join(", "));
      return;
    }
    if (field === "enableSecondRoster") {
      setEnableSecondRoster(Boolean(config.enableSecondRoster));
      return;
    }
    if (field === "zooMemberRoleIds") {
      setZooMemberRoleIds(resolveRoleIds(config));
      return;
    }
    if (field === "warsCount") {
      setWarsCount(String(config.warsCount));
      return;
    }
    if (field === "racesCount") {
      setRacesCount(String(config.racesCount));
      return;
    }
    if (field === "invasionsCount") {
      setInvasionsCount(String(config.invasionsCount));
      return;
    }
    if (field === "vodsCount") {
      setVodsCount(String(config.vodsCount));
      return;
    }
    if (field === "reviewsCount") {
      setReviewsCount(String(config.reviewsCount));
      return;
    }
    setBonusCount(String(config.bonusCount));
  }

  async function saveField(field: EditableFieldKey) {
    const payload: SaveServerConfigurationPayload = {};

    if (field === "apiKey") {
      payload.apiKey = apiKey;
    }
    if (field === "channelIds") {
      payload.channelIds = parseIdListFromString(channelIdsInput);
    }
    if (field === "enableSecondRoster") {
      payload.enableSecondRoster = enableSecondRoster;
    }
    if (field === "zooMemberRoleIds") {
      payload.zooMemberRoleIds = zooMemberRoleIds;
    }
    if (field === "warsCount") {
      const value = Number(warsCount);
      if (!Number.isInteger(value) || value < 0) {
        toast.error("War points must be an integer >= 0.");
        return;
      }
      payload.warsCount = value;
    }
    if (field === "racesCount") {
      const value = Number(racesCount);
      if (!Number.isInteger(value) || value < 0) {
        toast.error("Race points must be an integer >= 0.");
        return;
      }
      payload.racesCount = value;
    }
    if (field === "invasionsCount") {
      const value = Number(invasionsCount);
      if (!Number.isInteger(value) || value < 0) {
        toast.error("Invasion points must be an integer >= 0.");
        return;
      }
      payload.invasionsCount = value;
    }
    if (field === "vodsCount") {
      const value = Number(vodsCount);
      if (!Number.isInteger(value) || value < 0) {
        toast.error("Management points must be an integer >= 0.");
        return;
      }
      payload.vodsCount = value;
    }
    if (field === "reviewsCount") {
      const value = Number(reviewsCount);
      if (!Number.isInteger(value) || value < 0) {
        toast.error("Review points must be an integer >= 0.");
        return;
      }
      payload.reviewsCount = value;
    }
    if (field === "bonusCount") {
      const value = Number(bonusCount);
      if (!Number.isInteger(value) || value < 0) {
        toast.error("Bonus points must be an integer >= 0.");
        return;
      }
      payload.bonusCount = value;
    }

    try {
      setPendingField(field);
      const data = await saveMutation.mutateAsync(payload);
      queryClient.setQueryData(["server-configuration"], data);
      syncFromConfigurationData(data);
      if (field === "channelIds") {
        await queryClient.invalidateQueries({
          queryKey: ["raid-helper-events"],
        });
      }
      setEditingField(null);
      if (field === "channelIds") {
        const savedCount =
          data.configuration.channelIds?.length ??
          parseIdListFromString(data.configuration.channelId).length;
        toast.success(`Channel IDs saved (${savedCount}).`);
      } else {
        toast.success("Configuration saved.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown API error.";
      toast.error(message);
    } finally {
      setPendingField(null);
    }
  }

  if (configurationQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (configurationQuery.isError) {
    const errorMessage =
      configurationQuery.error instanceof Error
        ? configurationQuery.error.message
        : "Unable to load configuration.";

    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
        {errorMessage}
      </div>
    );
  }

  const guild = configurationQuery.data?.guild;
  const roles = configurationQuery.data?.roles ?? [];
  const rolesError = configurationQuery.data?.rolesError;
  const savedRoleNames =
    configurationQuery.data?.configuration.zooMemberRoleNames ?? [];
  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const selectedRoleItems = zooMemberRoleIds.map((roleId, index) => ({
    id: roleId,
    name: roleById.get(roleId) ?? savedRoleNames[index] ?? roleId,
    missing: !roleById.has(roleId),
  }));
  const addableRoles = roles.filter(
    (role) => !zooMemberRoleIds.includes(role.id),
  );
  const parsedChannelIds = parseIdListFromString(channelIdsInput);

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

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
      <h2 className="text-xl font-semibold text-slate-100">
        Server configuration
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Configure settings for
        <span className="ml-1 font-medium text-emerald-300">
          {guild?.name || guild?.id}
        </span>
        .
      </p>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="apiKey"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              API key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="apiKey"
                value={editingField === "apiKey" ? apiKey : maskApiKey(apiKey)}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="ex: sk_live_xxx"
                disabled={
                  editingField !== "apiKey" || pendingField === "apiKey"
                }
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
              htmlFor="channelId"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Discord Channel IDs
            </label>
            <div className="flex items-center gap-2">
              <input
                id="channelId"
                value={channelIdsInput}
                onChange={(event) => setChannelIdsInput(event.target.value)}
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
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-2">
              <div className="mb-1 text-xs text-slate-500">
                Saved/parsed channels: {parsedChannelIds.length}
              </div>
              {parsedChannelIds.length === 0 ? (
                <p className="text-xs text-slate-600">
                  No channel ID configured.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {parsedChannelIds.map((channelId) => (
                    <span
                      key={channelId}
                      className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200"
                    >
                      {channelId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="enableSecondRoster"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Enable second roster
            </label>
            <div className="flex items-center gap-2">
              <label
                htmlFor="enableSecondRoster"
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              >
                <span>Show roster 2 in roster page</span>
                <input
                  id="enableSecondRoster"
                  type="checkbox"
                  checked={enableSecondRoster}
                  onChange={(event) =>
                    setEnableSecondRoster(event.target.checked)
                  }
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
              htmlFor="zooMemberRoleId"
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
                  id="zooMemberRoleId"
                  value={roleToAdd}
                  onChange={(event) => setRoleToAdd(event.target.value)}
                  disabled={
                    editingField !== "zooMemberRoleIds" ||
                    pendingField === "zooMemberRoleIds"
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
              htmlFor="warsCount"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Point per War
            </label>
            <div className="flex items-center gap-2">
              <input
                id="warsCount"
                type="number"
                min={0}
                step={1}
                value={warsCount}
                onChange={(event) => setWarsCount(event.target.value)}
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
              htmlFor="racesCount"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Point per Races
            </label>
            <div className="flex items-center gap-2">
              <input
                id="racesCount"
                type="number"
                min={0}
                step={1}
                value={racesCount}
                onChange={(event) => setRacesCount(event.target.value)}
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
              htmlFor="invasionsCount"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Point per Invasion
            </label>
            <div className="flex items-center gap-2">
              <input
                id="invasionsCount"
                type="number"
                min={0}
                step={1}
                value={invasionsCount}
                onChange={(event) => setInvasionsCount(event.target.value)}
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
              htmlFor="vodsCount"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Point per Management
            </label>
            <div className="flex items-center gap-2">
              <input
                id="vodsCount"
                type="number"
                min={0}
                step={1}
                value={vodsCount}
                onChange={(event) => setVodsCount(event.target.value)}
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
              htmlFor="reviewsCount"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Point per Reviews
            </label>
            <div className="flex items-center gap-2">
              <input
                id="reviewsCount"
                type="number"
                min={0}
                step={1}
                value={reviewsCount}
                onChange={(event) => setReviewsCount(event.target.value)}
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
              htmlFor="bonusCount"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Point per Bonus
            </label>
            <div className="flex items-center gap-2">
              <input
                id="bonusCount"
                type="number"
                min={0}
                step={1}
                value={bonusCount}
                onChange={(event) => setBonusCount(event.target.value)}
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
      </div>
    </div>
  );
}
