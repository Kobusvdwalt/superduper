import { createFileRoute } from "@tanstack/react-router";

import { NotBuilt } from "@/components/not-built";

export const Route = createFileRoute("/_authenticated/finance")({
  component: () => <NotBuilt domain="Finance" />,
});
