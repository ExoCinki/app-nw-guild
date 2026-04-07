import { redirect } from "next/navigation";
import { GlobalAdminManager } from "@/components/global-admin-manager";
import { getOwnerGuardStatus } from "@/lib/admin-access";

export default async function AdminPage() {
  const ownerStatus = await getOwnerGuardStatus();

  if (ownerStatus.status !== "ok") {
    redirect("/");
  }

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Administration</h1>
          <p className="mt-2 text-slate-400">
            Users, default server selection, and server configuration overview.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <GlobalAdminManager />
        </div>
      </div>
    </main>
  );
}
