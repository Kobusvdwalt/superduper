import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { sessionQuery } from "@/lib/auth";
import { createQueryClient } from "@/lib/query-client";

import { createAppRouter } from "./router";

const queryClient = createQueryClient({
  onUnauthenticated: () => {
    queryClient.setQueryData(sessionQuery.queryKey, null);
    void router.invalidate();
  },
});
const router = createAppRouter(queryClient);

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element.");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
