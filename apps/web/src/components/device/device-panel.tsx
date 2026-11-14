import { useState, type FormEvent } from "react";

import { Facts, Section } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatNumber, humanize } from "@/lib/format";
import type { Availability, Grant, HealthStatus } from "@/lib/shell";

export function NotInShell() {
  return (
    <Alert>
      <AlertTitle>Only available in the app</AlertTitle>
      <AlertDescription>
        Health Connect syncing runs in the Super Duper Android app. Open this page there to pair the
        phone, grant permissions and follow its sync. In a browser you can still manage device
        tokens under Clients.
      </AlertDescription>
    </Alert>
  );
}

const AVAILABILITY: Record<Availability, string> = {
  available: "Available",
  update_required: "Not installed or needs an update",
  unavailable: "This device cannot run Health Connect",
  unsupported_platform: "Not available on this platform (Android only)",
};

export type DevicePanelHandlers = {
  onPair: () => void;
  onUnpair: () => void;
  onRequestPermissions: () => void;
  onOpenHealthConnect: () => void;
  onSyncNow: () => void;
  onAutoSyncChange: (enabled: boolean) => void;
  onHistoryDaysChange: (days: number) => void;
};

export function DevicePanel({
  status,
  busy,
  error,
  handlers,
}: {
  status: HealthStatus;
  busy: boolean;
  error: Error | null;
  handlers: DevicePanelHandlers;
}) {
  const { availability, permissions, pairing, settings, sync } = status;
  const available = availability === "available";

  return (
    <>
      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Section title="Health Connect">
        <Facts
          items={[
            ["Availability", AVAILABILITY[availability]],
            [
              "Record types granted",
              `${permissions.granted.length} of ${permissions.granted.length + permissions.missing.length}`,
            ],
            ["Background reads", <GrantBadge key="b" grant={permissions.background} />],
            ["History older than 30 days", <GrantBadge key="h" grant={permissions.history} />],
            ["Exercise routes", <GrantBadge key="r" grant={permissions.exerciseRoutes} />],
          ]}
        />
        {availability === "unsupported_platform" ? null : (
          <div className="mt-3 flex flex-wrap gap-2">
            {available ? (
              <Button
                onClick={handlers.onRequestPermissions}
                disabled={busy}
                variant={permissions.missing.length > 0 ? "default" : "outline"}
              >
                Request permissions
              </Button>
            ) : null}
            <Button variant="outline" onClick={handlers.onOpenHealthConnect} disabled={busy}>
              {available ? "Open Health Connect" : "Install or update Health Connect"}
            </Button>
          </div>
        )}
      </Section>

      {available ? (
        <>
          <Section title="Pairing">
            <PairingSummary pairing={pairing} />
            <div className="mt-3 flex flex-wrap gap-2">
              {!pairing.paired || pairing.needsRepair || !pairing.serverMatchesShell ? (
                <Button onClick={handlers.onPair} disabled={busy}>
                  {pairing.paired ? "Pair again" : "Pair this device"}
                </Button>
              ) : null}
              {pairing.paired ? (
                <Button variant="outline" onClick={handlers.onUnpair} disabled={busy}>
                  Unpair
                </Button>
              ) : null}
            </div>
          </Section>

          <Section title="Sync">
            <Facts
              items={[
                ["State", sync.running ? (sync.phase ?? "Running") : "Idle"],
                ["Last success", formatDateTime(sync.lastSuccessAt)],
                ["Last attempt", formatDateTime(sync.lastAttemptAt)],
                ["Last error", sync.lastError ?? "—"],
                [
                  "Queued",
                  `${formatNumber(sync.queuedBatches)} batches, ${formatNumber(sync.queuedRecords)} records, ${formatNumber(sync.queuedDeletions)} deletions`,
                ],
                ["Rejected batches", formatNumber(sync.rejectedBatches)],
              ]}
            />
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Button
                onClick={handlers.onSyncNow}
                disabled={busy || !pairing.paired || sync.running}
              >
                {sync.running ? "Syncing…" : "Sync now"}
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings.autoSync}
                  onCheckedChange={(checked) => handlers.onAutoSyncChange(checked)}
                  disabled={busy}
                />
                Sync automatically every hour
              </label>
            </div>
            <HistoryForm
              key={settings.historyDays}
              days={settings.historyDays}
              disabled={busy}
              onSave={handlers.onHistoryDaysChange}
            />
          </Section>

          {sync.types.length > 0 ? (
            <Section title="Record types">
              <TypesTable types={sync.types} />
            </Section>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function GrantBadge({ grant }: { grant: Grant }) {
  return <Badge variant={grant === "granted" ? "secondary" : "outline"}>{humanize(grant)}</Badge>;
}

function PairingSummary({ pairing }: { pairing: HealthStatus["pairing"] }) {
  if (!pairing.paired) {
    return <p className="text-sm">Not paired. Pairing creates a device client for this phone.</p>;
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Paired as client <code className="font-mono text-xs">{pairing.clientId}</code>.
      </p>
      {pairing.needsRepair ? (
        <p className="text-destructive">The server rejected this device's token. Pair again.</p>
      ) : null}
      {pairing.serverMatchesShell ? null : (
        <p className="text-destructive">
          This phone syncs to a different server than the one the app shows. Pair again to sync
          here.
        </p>
      )}
    </div>
  );
}

const MAX_HISTORY_DAYS = 36_500;

function HistoryForm({
  days,
  disabled,
  onSave,
}: {
  days: number;
  disabled: boolean;
  onSave: (days: number) => void;
}) {
  const [value, setValue] = useState(String(days));
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_HISTORY_DAYS;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && parsed !== days) onSave(parsed);
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="history-days">History window (days)</Label>
        <Input
          id="history-days"
          type="number"
          min={1}
          max={MAX_HISTORY_DAYS}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-32"
        />
      </div>
      <Button type="submit" variant="outline" disabled={disabled || !valid || parsed === days}>
        Save
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        How far back the first read goes. Changing it re-reads every type; records already sent are
        not sent again.
      </p>
    </form>
  );
}

function TypesTable({ types }: { types: HealthStatus["sync"]["types"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Record type</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Known</TableHead>
          <TableHead className="text-right">Queued</TableHead>
          <TableHead className="text-right">Sent</TableHead>
          <TableHead>Last read</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {types
          .filter((type) => type.supported)
          .map((type) => (
            <TableRow key={type.recordType}>
              <TableCell>{type.recordType}</TableCell>
              <TableCell>{humanize(type.state)}</TableCell>
              <TableCell className="text-right">{formatNumber(type.knownRecords)}</TableCell>
              <TableCell className="text-right">{formatNumber(type.queuedRecords)}</TableCell>
              <TableCell className="text-right">{formatNumber(type.sentRecords)}</TableCell>
              <TableCell>{formatDateTime(type.lastReadAt)}</TableCell>
              <TableCell>{type.lastError ?? "—"}</TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
