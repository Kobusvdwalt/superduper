import { createFileRoute, Link } from "@tanstack/react-router";

import { Facts, PageHeader, Section } from "@/components/page";

export const Route = createFileRoute("/_authenticated/settings/developer")({
  component: DeveloperPage,
});

const GRAPHQL_PATH = "/api/graphql";

function DeveloperPage() {
  return (
    <>
      <PageHeader title="Developer" description="Tools for working with the API." />
      <Section title="GraphQL">
        <p className="mb-3 text-sm">
          <a href={GRAPHQL_PATH} className="font-medium underline">
            Open the GraphQL explorer
          </a>{" "}
          to browse the schema and run queries. It uses this browser's session, so it reads your own
          data.
        </p>
        <Facts
          items={[
            ["Endpoint", `${window.location.origin}${GRAPHQL_PATH}`],
            [
              "Authentication",
              <>
                This session's cookie, or <code>Authorization: Bearer &lt;client token&gt;</code>{" "}
                with a token from{" "}
                <Link to="/settings/clients" className="underline">
                  Clients
                </Link>
                .
              </>,
            ],
          ]}
        />
      </Section>
    </>
  );
}
