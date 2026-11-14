import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formText } from "@/lib/form";

export type SignInMode = "sign-in" | "sign-up";
export type SignInValues = { mode: SignInMode; name: string; email: string; password: string };

export function SignInForm({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (values: SignInValues) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [mode, setMode] = useState<SignInMode>("sign-in");
  const signingUp = mode === "sign-up";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      mode,
      name: formText(form, "name").trim(),
      email: formText(form, "email").trim(),
      password: formText(form, "password"),
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{signingUp ? "Create the owner account" : "Sign in"}</CardTitle>
        <CardDescription>
          {signingUp
            ? "First-time setup. Only the owner email configured on the server can sign up."
            : "Super Duper is a single-user app."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {signingUp ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              minLength={signingUp ? 8 : undefined}
              required
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => setMode(signingUp ? "sign-in" : "sign-up")}
          >
            {signingUp ? "I already have an account" : "First time here? Create the owner account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
