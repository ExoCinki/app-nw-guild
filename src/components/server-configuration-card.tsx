"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPencil, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LoadingIndicator } from "@/components/loading-indicator";

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
    zooMemberRoleId: string;
    zooMemberRoleName: string;
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
  channelId?: string;
  zooMemberRoleId?: string | null;
  warsCount?: number;
  racesCount?: number;
  invasionsCount?: number;
  vodsCount?: number;
  reviewsCount?: number;
  bonusCount?: number;
};

type EditableFieldKey =
  | "apiKey"
  | "channelId"
  | "zooMemberRoleId"
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
            <LoadingIndicator />
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
  const [channelId, setChannelId] = useState("");
  const [zooMemberRoleId, setZooMemberRoleId] = useState("");
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
  });

  const saveMutation = useMutation({
    mutationFn: saveServerConfiguration,
  });

  function syncFromConfigurationData(data: ServerConfigurationResponse) {
    setApiKey(data.configuration.apiKey ?? "");
    setChannelId(data.configuration.channelId ?? "");
    setZooMemberRoleId(data.configuration.zooMemberRoleId ?? "");
    setWarsCount(String(data.configuration.warsCount));
    setRacesCount(String(data.configuration.racesCount));
    setInvasionsCount(String(data.configuration.invasionsCount));
    setVodsCount(String(data.configuration.vodsCount));
    setReviewsCount(String(data.configuration.reviewsCount));
    setBonusCount(String(data.configuration.bonusCount));
  }

  useEffect(() => {
    if (configurationQuery.data) {
      syncFromConfigurationData(configurationQuery.data);
    }
  }, [configurationQuery.data]);

  function resetField(field: EditableFieldKey) {
    const config = configurationQuery.data?.configuration;
    if (!config) {
      return;
    }

    if (field === "apiKey") {
      setApiKey(config.apiKey ?? "");
      return;
    }
    if (field === "channelId") {
      setChannelId(config.channelId ?? "");
      return;
    }
    if (field === "zooMemberRoleId") {
      setZooMemberRoleId(config.zooMemberRoleId ?? "");
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
    if (field === "channelId") {
      payload.channelId = channelId;
    }
    if (field === "zooMemberRoleId") {
      payload.zooMemberRoleId = zooMemberRoleId || null;
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
        toast.error("VOD points must be an integer >= 0.");
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
      setEditingField(null);
      toast.success("Configuration saved.");
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
  const selectedRoleExists = roles.some((role) => role.id === zooMemberRoleId);

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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              API key
            </label>
            <div className="flex items-center gap-2">
              <input
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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Discord Channel ID
            </label>
            <div className="flex items-center gap-2">
              <input
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
                placeholder="ex: 123456789012345678"
                disabled={
                  editingField !== "channelId" || pendingField === "channelId"
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
              />
              <EditButtons
                isEditing={editingField === "channelId"}
                isPending={pendingField === "channelId"}
                onSave={() => {
                  void saveField("channelId");
                }}
                onCancel={() => {
                  resetField("channelId");
                  setEditingField(null);
                }}
                onEdit={() => setEditingField("channelId")}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Member role
            </label>
            <div className="flex items-center gap-2">
              <select
                value={zooMemberRoleId}
                onChange={(event) => setZooMemberRoleId(event.target.value)}
                disabled={
                  editingField !== "zooMemberRoleId" ||
                  pendingField === "zooMemberRoleId"
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 disabled:opacity-70"
              >
                <option value="">-- No role --</option>
                {!selectedRoleExists && zooMemberRoleId ? (
                  <option value={zooMemberRoleId}>
                    {configurationQuery.data?.configuration.zooMemberRoleName ||
                      zooMemberRoleId}{" "}
                    (not found)
                  </option>
                ) : null}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <EditButtons
                isEditing={editingField === "zooMemberRoleId"}
                isPending={pendingField === "zooMemberRoleId"}
                onSave={() => {
                  void saveField("zooMemberRoleId");
                }}
                onCancel={() => {
                  resetField("zooMemberRoleId");
                  setEditingField(null);
                }}
                onEdit={() => setEditingField("zooMemberRoleId")}
              />
            </div>
            {rolesError ? (
              <p className="mt-2 text-xs text-amber-300">{rolesError}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per War
            </label>
            <div className="flex items-center gap-2">
              <input
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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Races
            </label>
            <div className="flex items-center gap-2">
              <input
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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Invasion
            </label>
            <div className="flex items-center gap-2">
              <input
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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Vods
            </label>
            <div className="flex items-center gap-2">
              <input
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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Reviews
            </label>
            <div className="flex items-center gap-2">
              <input
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
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Bonus
            </label>
            <div className="flex items-center gap-2">
              <input
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
