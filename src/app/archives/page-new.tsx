import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ArchivesClient } from "./archives-client";

export default async function ArchivesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[calc(100vh_-_64px)] w-full items-start justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <div className="w-full max-w-6xl">
        <ArchivesClient />
      </div>
    </main>
  );
}
