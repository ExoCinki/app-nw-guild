"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Toaster } from "sonner";
import { Navbar } from "@/components/navbar";
import { createAppQueryClient } from "@/lib/query-client";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());
  const pathname = usePathname();
  const shouldHideNavbar = pathname.startsWith("/payout/shared/");

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-full flex-col">
          {shouldHideNavbar ? null : <Navbar />}
          <main className="flex-1">{children}</main>
        </div>
        <Toaster richColors position="top-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
