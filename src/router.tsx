import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteError } from "@/components/RouteError";
import { RouteNotFound } from "@/components/RouteNotFound";
import { RouteSkeleton } from "@/components/RouteSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: false,
    defaultPreloadStaleTime: 0,
    defaultPreloadDelay: 30,
    defaultErrorComponent: RouteError as unknown as import("@tanstack/react-router").ErrorRouteComponent,
    defaultNotFoundComponent: RouteNotFound,
    defaultPendingComponent: RouteSkeleton,
    defaultPendingMs: 200,
  });

  return router;
};
