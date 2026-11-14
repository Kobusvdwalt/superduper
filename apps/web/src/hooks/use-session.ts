import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { sessionQuery, signIn, signOut, signUp } from "@/lib/auth";

export function useSession() {
  return useQuery(sessionQuery).data ?? null;
}

function useAfterAuthChange() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    // The sign-in page reads the session only in `beforeLoad`, so nothing observes the query
    // there and a plain invalidation would leave the stale signed-out value in the cache.
    await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey, refetchType: "all" });
    await router.invalidate();
  };
}

export function useSignIn() {
  const after = useAfterAuthChange();
  return useMutation({
    mutationFn: (input: {
      mode: "sign-in" | "sign-up";
      name: string;
      email: string;
      password: string;
    }) =>
      input.mode === "sign-in"
        ? signIn({ email: input.email, password: input.password })
        : signUp({ name: input.name, email: input.email, password: input.password }),
    onSuccess: after,
  });
}

export function useSignOut() {
  const after = useAfterAuthChange();
  return useMutation({ mutationFn: signOut, onSuccess: after });
}
