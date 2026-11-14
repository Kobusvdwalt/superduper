import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function TokenReveal({
  name,
  token,
  onDismiss,
}: {
  name: string;
  token: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  return (
    <Alert className="my-4">
      <AlertTitle>Token for {name}</AlertTitle>
      <AlertDescription>
        <p>This is the only time the token is shown. Store it in the client now.</p>
        <code
          className="my-2 block rounded bg-muted p-2 font-mono text-xs break-all"
          data-testid="client-token"
        >
          {token}
        </code>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(token).then(
                () => setCopied("yes"),
                () => setCopied("failed"),
              );
            }}
          >
            Copy token
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Done
          </Button>
          {copied === "yes" ? <span>Copied.</span> : null}
          {copied === "failed" ? <span>Copying failed; select the text instead.</span> : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
