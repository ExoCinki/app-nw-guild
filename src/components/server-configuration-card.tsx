"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type ServerConfigurationResponse = {
  guild: {
    id: string;
    name: string | null;
  };
  configuration: {
    apiKey: string;
    channelId: string;
    warsCount: number;
    racesCount: number;
    invasionsCount: number;
    vodsCount: number;
    reviewsCount: number;
    bonusCount: number;
    updatedAt: string | null;
  };
};

async function getServerConfiguration(): Promise<ServerConfigurationResponse> {
  const response = await fetch("/api/server-configuration", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? "Impossible de charger la configuration.",
    );
  }

  return response.json() as Promise<ServerConfigurationResponse>;
}

async function saveServerConfiguration(payload: {
  apiKey: string;
  channelId: string;
  warsCount: number;
  racesCount: number;
  invasionsCount: number;
  vodsCount: number;
  reviewsCount: number;
  bonusCount: number;
}) {
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
    throw new Error(
      errorPayload?.error ?? "Impossible de sauvegarder la configuration.",
    );
  }

  return response.json() as Promise<ServerConfigurationResponse>;
}

export function ServerConfigurationCard() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [channelId, setChannelId] = useState("");
  const [warsCount, setWarsCount] = useState("0");
  const [racesCount, setRacesCount] = useState("0");
  const [invasionsCount, setInvasionsCount] = useState("0");
  const [vodsCount, setVodsCount] = useState("0");
  const [reviewsCount, setReviewsCount] = useState("0");
  const [bonusCount, setBonusCount] = useState("0");

  const configurationQuery = useQuery({
    queryKey: ["server-configuration"],
    queryFn: getServerConfiguration,
  });

  const saveMutation = useMutation({
    mutationFn: saveServerConfiguration,
    onSuccess: async (data) => {
      toast.success("Configuration sauvegardee.");
      setApiKey(data.configuration.apiKey ?? "");
      setChannelId(data.configuration.channelId ?? "");
      setWarsCount(String(data.configuration.warsCount));
      setRacesCount(String(data.configuration.racesCount));
      setInvasionsCount(String(data.configuration.invasionsCount));
      setVodsCount(String(data.configuration.vodsCount));
      setReviewsCount(String(data.configuration.reviewsCount));
      setBonusCount(String(data.configuration.bonusCount));
      await queryClient.invalidateQueries({
        queryKey: ["server-configuration"],
      });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Erreur API inconnue.";
      toast.error(message);
    },
  });

  useEffect(() => {
    if (configurationQuery.data) {
      setApiKey(configurationQuery.data.configuration.apiKey ?? "");
      setChannelId(configurationQuery.data.configuration.channelId ?? "");
      setWarsCount(String(configurationQuery.data.configuration.warsCount));
      setRacesCount(String(configurationQuery.data.configuration.racesCount));
      setInvasionsCount(
        String(configurationQuery.data.configuration.invasionsCount),
      );
      setVodsCount(String(configurationQuery.data.configuration.vodsCount));
      setReviewsCount(
        String(configurationQuery.data.configuration.reviewsCount),
      );
      setBonusCount(String(configurationQuery.data.configuration.bonusCount));
    }
  }, [configurationQuery.data]);

  if (configurationQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-sm text-slate-300">
        Chargement de la configuration serveur...
      </div>
    );
  }

  if (configurationQuery.isError) {
    const errorMessage =
      configurationQuery.error instanceof Error
        ? configurationQuery.error.message
        : "Impossible de charger la configuration.";

    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
        {errorMessage}
      </div>
    );
  }

  const guild = configurationQuery.data?.guild;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 backdrop-blur">
      <h2 className="text-xl font-semibold text-slate-100">
        Configuration serveur
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Configure les parametres pour
        <span className="ml-1 font-medium text-emerald-300">
          {guild?.name || guild?.id}
        </span>
        .
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();

          const metrics = [
            Number(warsCount),
            Number(racesCount),
            Number(invasionsCount),
            Number(vodsCount),
            Number(reviewsCount),
            Number(bonusCount),
          ];

          const hasInvalidMetric = metrics.some(
            (value) => !Number.isInteger(value) || value < 0,
          );

          if (hasInvalidMetric) {
            toast.error(
              "Tous les champs numeriques doivent etre des entiers >= 0.",
            );
            return;
          }

          saveMutation.mutate({
            apiKey,
            channelId,
            warsCount: Number(warsCount),
            racesCount: Number(racesCount),
            invasionsCount: Number(invasionsCount),
            vodsCount: Number(vodsCount),
            reviewsCount: Number(reviewsCount),
            bonusCount: Number(bonusCount),
          });
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Cle API
            </label>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="ex: sk_live_xxx"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Discord Channel ID
            </label>
            <input
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              placeholder="ex: 123456789012345678"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per War
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={warsCount}
              onChange={(event) => setWarsCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Races
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={racesCount}
              onChange={(event) => setRacesCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Invasion
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={invasionsCount}
              onChange={(event) => setInvasionsCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Vods
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={vodsCount}
              onChange={(event) => setVodsCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Reviews
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={reviewsCount}
              onChange={(event) => setReviewsCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Point per Bonus
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={bonusCount}
              onChange={(event) => setBonusCount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          disabled={saveMutation.isPending}
        >
          Sauvegarder
        </button>
      </form>
    </div>
  );
}
