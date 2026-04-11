import type { DetailShellProps } from "./detail-shell-shared";
import { Card, CardContent } from "@/components/ui/card";

export default function DetailShellMetaGrid({
  meta,
}: {
  meta: NonNullable<DetailShellProps["meta"]>;
}) {
  return (
    <Card className="mb-8 border-border/70 bg-card/40 shadow-none">
      <CardContent className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          {meta.map((m) => (
            <div key={m.label}>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{m.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
