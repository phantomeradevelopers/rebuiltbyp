import { useQuery } from "@tanstack/react-query";
import { getAccessStatus } from "@/lib/access.functions";
import type { Tier } from "@/lib/tier";

/**
 * Returns the current user's tier (free | pro | elite | lifetime_pro).
 * Falls back to "free" while loading or on error so gates fail closed.
 */
export function useTier(): Tier {
  const { data } = useQuery({
    queryKey: ["access-status"],
    queryFn: () => getAccessStatus(),
    staleTime: 60_000,
  });
  return (data?.tier ?? "free") as Tier;
}
