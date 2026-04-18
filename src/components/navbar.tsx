"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // When the destination is reached, clear the navigating state (during render, no effect needed)
  if (navigatingTo !== null && navigatingTo === pathname) {
    setNavigatingTo(null);
  }

  const isNavigating = navigatingTo !== null && navigatingTo !== pathname;
  const handleNavClick = (href: string) => setNavigatingTo(href);

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
  const isNavLoading =
    status === "loading" || (status === "authenticated" && meQuery.isLoading);
  const canAccessRoster = Boolean(access?.roster);
  const canAccessPayout = Boolean(access?.payout);
  const canAccessScoreboard = Boolean(access?.scoreboard);
  const canAccessArchives = Boolean(access?.archives);
  const canAccessConfiguration = Boolean(access?.configuration);
  const canShowSelectedGuild = Boolean(meQuery.data?.hasSelectedGuildAccess);

  const isActive = (path: string) =>
    pathname === path ? "text-sky-400" : "text-slate-300 hover:text-slate-100";

  return (
    <nav className="relative border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      {isNavigating && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div className="h-full w-2/3 animate-pulse bg-sky-400" />
        </div>
      )}
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
              onClick={() => handleNavClick("/")}
            >
              Home
            </Link>
            {isNavLoading ? (
              <>
                <div className="h-4 w-12 animate-pulse rounded bg-slate-700" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-700" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-700" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-700" />
              </>
            ) : null}
            {!isNavLoading && session?.user && canAccessRoster ? (
              <Link
                href="/roster"
                className={`text-sm font-medium transition ${isActive("/roster")}`}
                onClick={() => handleNavClick("/roster")}
              >
                Roster
              </Link>
            ) : null}
            {!isNavLoading && session?.user && canAccessPayout ? (
              <Link
                href="/payout"
                className={`text-sm font-medium transition ${isActive("/payout")}`}
                onClick={() => handleNavClick("/payout")}
              >
                Payout
              </Link>
            ) : null}
            {!isNavLoading && session?.user && canAccessScoreboard ? (
              <Link
                href="/scoreboard"
                className={`text-sm font-medium transition ${isActive("/scoreboard")}`}
                onClick={() => handleNavClick("/scoreboard")}
              >
                Scoreboard
              </Link>
            ) : null}
            {!isNavLoading && session?.user && canAccessArchives ? (
              <Link
                href="/archives"
                className={`text-sm font-medium transition ${isActive("/archives")}`}
                onClick={() => handleNavClick("/archives")}
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
                    onClick={() => handleNavClick("/configuration")}
                  >
                    Configuration
                  </Link>
                ) : null}
              </div>

              {canAccessAdmin ? (
                <Link
                  href="/admin"
                  className={`text-sm font-medium transition ${isActive("/admin")}`}
                  onClick={() => handleNavClick("/admin")}
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
