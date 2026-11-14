import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";

import { SignInForm } from "@/components/sign-in-form";
import { useSignIn } from "@/hooks/use-session";
import { sessionQuery } from "@/lib/auth";
import { safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (session) throw redirect({ href: safeRedirect(search.redirect), replace: true });
  },
  component: SignInPage,
});

function SignInPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const signIn = useSignIn();
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <SignInForm
        pending={signIn.isPending}
        error={signIn.error}
        onSubmit={(values) =>
          signIn.mutate(values, {
            onSuccess: () => router.history.replace(safeRedirect(search.redirect)),
          })
        }
      />
    </div>
  );
}
