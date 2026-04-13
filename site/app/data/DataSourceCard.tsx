import { Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataSource } from "./data-shared";
import { TRUST_TINT } from "./data-shared";

export default function DataSourceCard({ source }: { source: DataSource }) {
  return (
    <Card id={source.id}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{source.number}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={TRUST_TINT[source.trust]}>{source.trust}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 px-2 py-0.5 font-mono text-[10px] font-normal text-muted-foreground hover:border-accent hover:text-accent"
              asChild
            >
              <a href={source.page.includes("[") ? "#" : source.page}>{source.page}</a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-start gap-2 text-xs">
          <Code2 size={11} className="mt-1 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source
            </p>
            <code className="text-xs text-foreground/90">{source.source}</code>
          </div>
        </div>
        {source.formula && (
          <div className="mb-2 ml-5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Formula
            </p>
            <code className="text-xs text-foreground/90">{source.formula}</code>
          </div>
        )}
        {source.notes && (
          <p className="ml-5 mt-2 border-l-2 border-accent/40 pl-3 text-xs leading-5 text-muted-foreground">
            {source.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
