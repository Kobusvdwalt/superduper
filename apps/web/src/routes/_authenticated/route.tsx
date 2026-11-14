import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppLayout } from "@/components/app-layout";
import { useSession, useSignOut } from "@/hooks/use-session";
import { sessionQuery } from "@/lib/auth";
import { NAVIGATION } from "@/lib/navigation";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href }, replace: true });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const session = useSession();
  const signOut = useSignOut();
  return (
    <AppLayout
      navigation={NAVIGATION}
      email={session?.user.email ?? ""}
      onSignOut={() => signOut.mutate()}
      signingOut={signOut.isPending}
    >
      <Outlet />
    </AppLayout>
  );
}
