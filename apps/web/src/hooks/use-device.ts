import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { graphql } from "@/gql";
import { executorOf } from "@/lib/query-client";
import { detectShell, type HealthStatus, type Shell } from "@/lib/shell";

const STATUS_KEY = ["shell", "health", "status"] as const;

const CreateDeviceClient = graphql(`
  mutation CreateDeviceClient($input: CreateClientInput!) {
    identity {
      createClient(input: $input) {
        token
        client {
          id
        }
      }
    }
  }
`);

const RevokeDeviceClient = graphql(`
  mutation RevokeDeviceClient($id: UUID!) {
    identity {
      revokeClient(id: $id) {
        id
      }
    }
  }
`);

export function useShell(): Shell | null {
  const [shell] = useState(() => detectShell());
  return shell;
}

export function useHealthStatus(shell: Shell | null) {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => (shell as Shell).health.status(),
    enabled: shell !== null,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.sync.running ? 2_000 : false),
  });
}

function useStatusAction<TInput>(run: (input: TInput) => Promise<HealthStatus>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (status) => queryClient.setQueryData(STATUS_KEY, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...STATUS_KEY] }),
  });
}

/** Device actions; each resolves with the shell's new status, which replaces the cached one. */
export function useDeviceActions(shell: Shell) {
  const queryClient = useQueryClient();
  const execute = executorOf(queryClient);

  const pair = useStatusAction<void>(async () => {
    const created = await execute(CreateDeviceClient, {
      input: { kind: "DEVICE", name: deviceName(shell), platform: shell.platform },
    });
    const { token, client } = created.identity.createClient;
    let status: HealthStatus;
    try {
      status = await shell.health.pair({ token, clientId: client.id });
    } catch (error) {
      await execute(RevokeDeviceClient, { id: client.id }).catch(() => undefined);
      throw error;
    }
    void queryClient.invalidateQueries({ queryKey: ["Clients"] });
    if (status.permissions.missing.length > 0) return shell.health.requestPermissions();
    return status;
  });

  const unpair = useStatusAction<void>(async () => {
    const before = queryClient.getQueryData<HealthStatus>(STATUS_KEY);
    const status = await shell.health.unpair();
    const clientId = before?.pairing.serverMatchesShell ? before.pairing.clientId : null;
    if (clientId) {
      await execute(RevokeDeviceClient, { id: clientId }).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ["Clients"] });
    }
    return status;
  });

  return {
    pair,
    unpair,
    requestPermissions: useStatusAction<void>(() => shell.health.requestPermissions()),
    openHealthConnect: useStatusAction<void>(() => shell.health.openHealthConnect()),
    syncNow: useStatusAction<void>(() => shell.health.syncNow()),
    setAutoSync: useStatusAction((enabled: boolean) => shell.health.setAutoSync(enabled)),
    setHistoryDays: useStatusAction((days: number) => shell.health.setHistoryDays(days)),
  };
}

function deviceName(shell: Shell): string {
  const platform = shell.platform.charAt(0).toUpperCase() + shell.platform.slice(1);
  return `${platform} app`;
}
