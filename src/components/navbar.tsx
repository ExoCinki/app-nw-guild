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

  const selectedGuildQuery = useQuery({
    queryKey: ["selected-guild"],
    queryFn: getSelectedGuild,
    enabled: status === "authenticated",
    ...queryPresets.mediumLived,
  });

  const isOwner = Boolean(session?.user?.isOwner);
  const canAccessAdmin = Boolean(isOwner || session?.user?.isGlobalAdmin);

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
            {session?.user ? (
              <Link
                href="/roster"
                className={`text-sm font-medium transition ${isActive("/roster")}`}
              >
                Roster
              </Link>
            ) : null}
            {session?.user ? (
              <Link
                href="/payout"
                className={`text-sm font-medium transition ${isActive("/payout")}`}
              >
                Payout
              </Link>
            ) : null}
            {session?.user ? (
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
              {selectedGuildQuery.data?.selectedGuild ? (
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

                <Link
                  href="/configuration"
                  className={`text-sm font-medium transition ${isActive("/configuration")}`}
                >
                  Configuration
                </Link>
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
