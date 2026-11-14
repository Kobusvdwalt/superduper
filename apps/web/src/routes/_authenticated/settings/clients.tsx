import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ClientsTable } from "@/components/clients/clients-table";
import { CreateClientForm } from "@/components/clients/create-client-form";
import { TokenReveal } from "@/components/clients/token-reveal";
import { PageHeader, Section } from "@/components/page";
import { EmptyState, ErrorState, QueryState } from "@/components/states";
import { useClients, useCreateClient, useRevokeClient } from "@/hooks/use-clients";

export const Route = createFileRoute("/_authenticated/settings/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const clients = useClients();
  const create = useCreateClient();
  const revoke = useRevokeClient();
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Devices and connectors that push data, each with its own revocable token."
      />
      <Section title="New client">
        <CreateClientForm
          pending={create.isPending}
          onCreate={(input) =>
            create.mutate(
              { input },
              {
                onSuccess: (data) =>
                  setCreated({
                    name: data.identity.createClient.client.name,
                    token: data.identity.createClient.token,
                  }),
              },
            )
          }
        />
        {create.error ? <ErrorState error={create.error} /> : null}
        {created ? (
          <TokenReveal
            name={created.name}
            token={created.token}
            onDismiss={() => setCreated(null)}
          />
        ) : null}
      </Section>
      <Section title="All clients">
        {revoke.error ? <ErrorState error={revoke.error} /> : null}
        <QueryState
          query={{ ...clients, data: clients.clients }}
          isEmpty={(rows) => rows.length === 0}
          empty={<EmptyState title="No clients yet" />}
        >
          {(rows) => (
            <ClientsTable
              clients={rows}
              revokingId={revoke.isPending ? (revoke.variables?.id ?? null) : null}
              onRevoke={(id) => revoke.mutate({ id })}
            />
          )}
        </QueryState>
      </Section>
    </>
  );
}
