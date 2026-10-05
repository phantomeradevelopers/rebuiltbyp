import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Goes back in browser history if there's somewhere to go back to;
 * otherwise navigates to the provided fallback route. Keeps "Back"
 * buttons from always dumping users into Settings regardless of origin.
 */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: fallback as never });
  }, [navigate, fallback]);
}
