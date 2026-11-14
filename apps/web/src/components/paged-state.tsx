import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";

/** Loading, error and empty states plus "load more" for a cursor-paged query. */
export function PagedState<TPage, TItem>({
  pages,
  items,
  empty,
  children,
}: {
  pages: UseInfiniteQueryResult<InfiniteData<TPage>>;
  items: (page: TPage) => TItem[];
  empty: ReactNode;
  children: (items: TItem[]) => ReactNode;
}) {
  if (pages.error) return <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />;
  if (pages.isPending) return <LoadingState />;
  const all = pages.data.pages.flatMap(items);
  if (all.length === 0) return <>{empty}</>;
  return (
    <>
      {children(all)}
      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{all.length} shown</span>
        {pages.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void pages.fetchNextPage()}
            disabled={pages.isFetchingNextPage}
          >
            {pages.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : (
          <span>· end of results</span>
        )}
      </div>
    </>
  );
}
