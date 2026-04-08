import { QueryClient } from "@tanstack/react-query";

export function createAppQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Global default tuned for dashboard-style app screens.
                staleTime: 2 * 60 * 1000,
                refetchOnWindowFocus: false,
                refetchOnReconnect: true,
                retry: 1,
            },
            mutations: {
                retry: 0,
            },
        },
    });
}
