import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

import { ErrorState } from "@/components/states";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  errorComponent: ({ error, reset }) => (
    <div className="p-8">
      <ErrorState error={error} onRetry={reset} />
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8">
      <p className="mb-2">This page does not exist.</p>
      <Link to="/" className="underline">
        Go home
      </Link>
    </div>
  ),
});
