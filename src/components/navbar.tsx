"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryPresets } from "@/lib/query-presets";
import { apiFetch } from "@/lib/http-client";

type SelectedGuildResponse = {
  selectedGuildId: string | null;
  selectedGuild: {
    id: string;
    name: string | null;
    iconUrl: string | null;
  } | null;
};

type MeResponse = {
  user: {
    id: string;
    displayName: string | null;
    discordId: string | null;
    email: string | null;
    image: string | null;
  };
  selectedGuildId: string | null;
  hasSelectedGuildAccess: boolean;
  access: {
    roster: boolean;
    payout: boolean;
    scoreboard: boolean;
    configuration: boolean;
    archives: boolean;
  };
};

async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>(
    "/api/me",
    { method: "GET" },
    "Unable to load profile.",
  );
}

async function getSelectedGuild(): Promise<SelectedGuildResponse> {
  try {
    return await apiFetch<SelectedGuildResponse>(
      "/api/selected-guild",
      { method: "GET" },
      "Unable to load selected guild.",
    );
  } catch {
    return {
      selectedGuildId: null,
      selectedGuild: null,
    };
  }
}

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: status === "authenticated",
    ...queryPresets.longLived,
  });

  const selectedGuildQuery = useQuery({
    queryKey: ["selected-guild"],
    queryFn: getSelectedGuild,
    enabled: status === "authenticated",
    ...queryPresets.mediumLived,
  });

  const isOwner = Boolean(session?.user?.isOwner);
  const canAccessAdmin = Boolean(isOwner || session?.user?.isGlobalAdmin);
  const access = meQuery.data?.access;
  const canAccessRoster = Boolean(access?.roster);
  const canAccessPayout = Boolean(access?.payout);
  const canAccessScoreboard = Boolean(access?.scoreboard);
  const canAccessArchives = Boolean(access?.archives);
  const canAccessConfiguration = Boolean(access?.configuration);
  const canShowSelectedGuild = Boolean(meQuery.data?.hasSelectedGuildAccess);

  const isActive = (path: string) =>
    pathname === path ? "text-sky-400" : "text-slate-300 hover:text-slate-100";

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center"
              aria-label="NW Guild Manager home"
            >
              <Image
                src="/android-chrome-192x192.png"
                alt="NW Guild Manager"
                width={64}
                height={64}
                className="rounded-sm"
              />
            </Link>
            <Link
              href="/"
              className={`text-sm font-medium transition ${isActive("/")}`}
            >
              Home
            </Link>
            {session?.user && canAccessRoster ? (
              <Link
                href="/roster"
                className={`text-sm font-medium transition ${isActive("/roster")}`}
              >
                Roster
              </Link>
            ) : null}
            {session?.user && canAccessPayout ? (
              <Link
                href="/payout"
                className={`text-sm font-medium transition ${isActive("/payout")}`}
              >
                Payout
              </Link>
            ) : null}
            {session?.user && canAccessScoreboard ? (
              <Link
                href="/scoreboard"
                className={`text-sm font-medium transition ${isActive("/scoreboard")}`}
              >
                Scoreboard
              </Link>
            ) : null}
            {session?.user && canAccessArchives ? (
              <Link
                href="/archives"
                className={`text-sm font-medium transition ${isActive("/archives")}`}
              >
                Archives
              </Link>
            ) : null}
          </div>

          {session?.user ? (
            <div className="flex items-center gap-6">
              {canShowSelectedGuild &&
              selectedGuildQuery.data?.selectedGuild ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-700/40 bg-emerald-900/20 px-2 py-1">
                  {selectedGuildQuery.data.selectedGuild.iconUrl ? (
                    <Image
                      src={selectedGuildQuery.data.selectedGuild.iconUrl}
                      alt={
                        selectedGuildQuery.data.selectedGuild.name ?? "Server"
                      }
                      width={22}
                      height={22}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="h-[22px] w-[22px] rounded-full bg-emerald-800/60" />
                  )}
                  <span className="max-w-44 truncate text-xs font-medium text-emerald-300">
                    {selectedGuildQuery.data.selectedGuild.name ??
                      selectedGuildQuery.data.selectedGuild.id}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.displayName ?? "Avatar"}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-700" />
                )}
                <span className="text-sm font-medium text-slate-200">
                  {session.user.displayName ?? session.user.name ?? "User"}
                </span>

                {canAccessConfiguration ? (
                  <Link
                    href="/configuration"
                    className={`text-sm font-medium transition ${isActive("/configuration")}`}
                  >
                    Configuration
                  </Link>
                ) : null}
              </div>

              {canAccessAdmin ? (
                <Link
                  href="/admin"
                  className={`text-sm font-medium transition ${isActive("/admin")}`}
                >
                  Administration
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-400">Not signed in</div>
          )}
        </div>
      </div>
    </nav>
  );
}
