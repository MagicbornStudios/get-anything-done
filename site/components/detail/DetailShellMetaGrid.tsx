import type { DetailShellProps } from "./detail-shell-shared";

export default function DetailShellMetaGrid({
  meta,
}: {
  meta: NonNullable<DetailShellProps["meta"]>;
}) {
  return (
    <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border/70 bg-card/40 p-5 md:grid-cols-3">
      {meta.map((m) => (
        <div key={m.label}>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {m.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{m.value}</dd>
        </div>
      ))}
    </dl>
  );
}
