import { Suspense } from "react";
import PublicScoreboardClient from "./public-scoreboard-client";
import { LoadingIndicator } from "@/components/loading-indicator";

export default function PublicScoreboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh_-_64px)] items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <LoadingIndicator />
        </div>
      }
    >
      <PublicScoreboardClient />
    </Suspense>
  );
}
