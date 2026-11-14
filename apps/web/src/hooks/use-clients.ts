import { graphql } from "@/gql";
import { useGqlMutation, useGqlQuery } from "@/lib/graphql-hooks";

const Clients = graphql(`
  query Clients {
    identity {
      clients {
        id
        name
        kind
        platform
        createdAt
        lastSeenAt
        revokedAt
      }
    }
    health {
      clientSyncs {
        client {
          id
        }
        lastSyncedAt
        batches
      }
    }
  }
`);

export function useClients() {
  const query = useGqlQuery(Clients);
  const syncs = new Map(
    (query.data?.health.clientSyncs ?? []).map((sync) => [sync.client.id, sync]),
  );
  const clients = query.data?.identity.clients.map((client) => ({
    ...client,
    lastSyncedAt: syncs.get(client.id)?.lastSyncedAt ?? null,
    batches: syncs.get(client.id)?.batches ?? 0,
  }));
  return { ...query, clients };
}

const CreateClient = graphql(`
  mutation CreateClient($input: CreateClientInput!) {
    identity {
      createClient(input: $input) {
        token
        client {
          id
          name
        }
      }
    }
  }
`);

export function useCreateClient() {
  return useGqlMutation(CreateClient, { invalidate: [Clients] });
}

const RevokeClient = graphql(`
  mutation RevokeClient($id: UUID!) {
    identity {
      revokeClient(id: $id) {
        id
        revokedAt
      }
    }
  }
`);

export function useRevokeClient() {
  return useGqlMutation(RevokeClient, { invalidate: [Clients] });
}
