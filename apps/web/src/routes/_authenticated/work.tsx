import { createFileRoute } from "@tanstack/react-router";

import { NotBuilt } from "@/components/not-built";

export const Route = createFileRoute("/_authenticated/work")({
  component: () => <NotBuilt domain="Work" />,
});
