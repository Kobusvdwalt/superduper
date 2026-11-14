import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientKind } from "@/gql/graphql";
import { formatDateTime, humanize } from "@/lib/format";

type Client = {
  id: string;
  name: string;
  kind: ClientKind;
  platform?: string | null;
  createdAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  lastSyncedAt: string | null;
  batches: number;
};

export function ClientsTable({
  clients,
  onRevoke,
  revokingId,
}: {
  clients: Client[];
  onRevoke: (id: string) => void;
  revokingId: string | null;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last seen</TableHead>
          <TableHead>Last health sync</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">{client.name}</TableCell>
            <TableCell>
              {humanize(client.kind)}
              {client.platform ? ` · ${client.platform}` : null}
            </TableCell>
            <TableCell>{formatDateTime(client.createdAt)}</TableCell>
            <TableCell>{formatDateTime(client.lastSeenAt)}</TableCell>
            <TableCell>
              {client.lastSyncedAt
                ? `${formatDateTime(client.lastSyncedAt)} (${client.batches} batches)`
                : "never"}
            </TableCell>
            <TableCell>
              {client.revokedAt ? (
                <Badge variant="secondary">revoked {formatDateTime(client.revokedAt)}</Badge>
              ) : (
                <Badge variant="outline">active</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {client.revokedAt ? null : confirming === client.id ? (
                <span className="flex justify-end gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={revokingId === client.id}
                    onClick={() => onRevoke(client.id)}
                  >
                    Confirm revoke
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirming(client.id)}>
                  Revoke
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
