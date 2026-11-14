import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page";

export const Route = createFileRoute("/_authenticated/settings/device")({
  component: DevicePage,
});

function DevicePage() {
  return <PageHeader title="This device" />;
}
