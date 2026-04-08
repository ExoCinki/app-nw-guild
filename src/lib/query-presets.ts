export const queryPresets = {
  longLived: {
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: true as const,
  },
  mediumLived: {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: true as const,
  },
  shortLived: {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: true as const,
  },
  search: {
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: true as const,
  },
};
