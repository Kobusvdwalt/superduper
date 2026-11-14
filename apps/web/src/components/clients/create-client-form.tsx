import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ClientKind, CreateClientInput } from "@/gql/graphql";
import { formText } from "@/lib/form";

export function CreateClientForm({
  onCreate,
  pending,
}: {
  onCreate: (input: CreateClientInput) => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<ClientKind>("CONNECTOR");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const platform = formText(form, "platform").trim();
    onCreate({ name: formText(form, "name").trim(), kind, platform: platform || null });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="client-name">Name</Label>
        <Input id="client-name" name="name" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="client-kind">Kind</Label>
        <NativeSelect
          id="client-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as ClientKind)}
        >
          <NativeSelectOption value="CONNECTOR">Connector</NativeSelectOption>
          <NativeSelectOption value="DEVICE">Device</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="client-platform">Platform (optional)</Label>
        <Input id="client-platform" name="platform" placeholder="android" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create client"}
      </Button>
    </form>
  );
}
