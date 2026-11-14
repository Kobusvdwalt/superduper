import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NavGroup } from "@/lib/navigation";

export function AppLayout({
  navigation,
  email,
  onSignOut,
  signingOut,
  children,
}: {
  navigation: NavGroup[];
  email: string;
  onSignOut: () => void;
  signingOut: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="border-b p-4 md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <Link to="/" className="mb-6 block text-lg font-semibold">
          Super Duper
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-4">
          {navigation.map((group) => (
            <div key={group.label}>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.to === "/health" }}
                      className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted data-[status=active]:bg-muted data-[status=active]:font-medium"
                    >
                      {item.label}
                      {item.built ? null : <Badge variant="outline">soon</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-6 border-t pt-4 text-sm">
          <p className="truncate text-muted-foreground" title={email}>
            {email}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
