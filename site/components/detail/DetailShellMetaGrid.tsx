import { Identified } from "gad-visual-context";
import type { DetailShellProps } from "./detail-shell-shared";
import { Card, CardContent } from "@/components/ui/card";

export default function DetailShellMetaGrid({
  meta,
}: {
  meta: NonNullable<DetailShellProps["meta"]>;
}) {
  return (
    <Identified as="DetailShellMetaGrid">
      <Card className="mb-8 border-border/70 bg-card/40 shadow-none">
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
            {meta.map((m, i) => (
              <Identified
                key={`${m.label}-${i}`}
                as={`DetailShellMetaItem-${m.label.replace(/[^a-zA-Z0-9]+/g, "-") || `idx-${i}`}`}
                tag="div"
              >
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{m.value}</dd>
              </Identified>
            ))}
          </dl>
        </CardContent>
      </Card>
    </Identified>
  );
}
