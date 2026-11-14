export function JsonView({ value, label }: { value: unknown; label: string }) {
  return (
    <pre
      aria-label={label}
      className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-3 text-xs"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
