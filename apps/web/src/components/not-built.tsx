import { PageHeader } from "@/components/page";
import { EmptyState } from "@/components/states";

export function NotBuilt({ domain }: { domain: string }) {
  return (
    <>
      <PageHeader title={domain} />
      <EmptyState title="Not built yet">
        The API has no {domain.toLowerCase()} domain yet. It will appear here once clients can push
        it.
      </EmptyState>
    </>
  );
}
