import { createFileRoute } from "@tanstack/react-router";

import { DevicePanel, NotInShell } from "@/components/device/device-panel";
import { PageHeader } from "@/components/page";
import { QueryState } from "@/components/states";
import { useDeviceActions, useHealthStatus, useShell } from "@/hooks/use-device";
import type { Shell } from "@/lib/shell";

export const Route = createFileRoute("/_authenticated/settings/device")({
  component: DevicePage,
});

function DevicePage() {
  const shell = useShell();
  return (
    <>
      <PageHeader
        title="This device"
        description="Health Connect sync for the phone running the Super Duper app."
      />
      {shell ? <ShellDevice shell={shell} /> : <NotInShell />}
    </>
  );
}

function ShellDevice({ shell }: { shell: Shell }) {
  const status = useHealthStatus(shell);
  const actions = useDeviceActions(shell);
  const all = Object.values(actions);
  const busy = all.some((action) => action.isPending);
  const latest = all.toSorted((a, b) => b.submittedAt - a.submittedAt)[0];
  const error = latest?.error ?? null;

  return (
    <QueryState query={status}>
      {(current) => (
        <DevicePanel
          status={current}
          busy={busy}
          error={error}
          handlers={{
            onPair: () => actions.pair.mutate(),
            onUnpair: () => actions.unpair.mutate(),
            onRequestPermissions: () => actions.requestPermissions.mutate(),
            onOpenHealthConnect: () => actions.openHealthConnect.mutate(),
            onSyncNow: () => actions.syncNow.mutate(),
            onAutoSyncChange: (enabled) => actions.setAutoSync.mutate(enabled),
            onHistoryDaysChange: (days) => actions.setHistoryDays.mutate(days),
          }}
        />
      )}
    </QueryState>
  );
}
