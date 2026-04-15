import { Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataSource } from "./data-shared";
import { TRUST_TINT } from "./data-shared";

export type DataSourceVisibleFields = {
  surface: boolean;
  source: boolean;
  formula: boolean;
  notes: boolean;
  page: boolean;
  trust: boolean;
};

type DataSourceCardProps = {
  source: DataSource;
  visibleFields?: DataSourceVisibleFields;
};

const DEFAULT_VISIBLE_FIELDS: DataSourceVisibleFields = {
  surface: true,
  source: true,
  formula: true,
  notes: true,
  page: true,
  trust: true,
};

export default function DataSourceCard({ source, visibleFields = DEFAULT_VISIBLE_FIELDS }: DataSourceCardProps) {
  return (
    <Card id={source.id}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{source.number}</CardTitle>
          <div className="flex items-center gap-2">
            {visibleFields.trust ? <Badge variant={TRUST_TINT[source.trust]}>{source.trust}</Badge> : null}
            {visibleFields.page ? (
              <Button
                variant="outline"
                size="sm"
                className="h-auto gap-1 px-2 py-0.5 font-mono text-[10px] font-normal text-muted-foreground hover:border-accent hover:text-accent"
                asChild
              >
                <a href={source.page.includes("[") ? "#" : source.page}>{source.page}</a>
              </Button>
            ) : null}
            {visibleFields.surface ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {source.surface}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {visibleFields.source ? (
          <div className="mb-2 flex items-start gap-2 text-xs">
            <Code2 size={11} className="mt-1 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Source
              </p>
              <code className="text-xs text-foreground/90">{source.source}</code>
            </div>
          </div>
        ) : null}
        {visibleFields.formula && source.formula ? (
          <div className="mb-2 ml-5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Formula
            </p>
            <code className="text-xs text-foreground/90">{source.formula}</code>
          </div>
        ) : null}
        {visibleFields.notes && source.notes ? (
          <p className="ml-5 mt-2 border-l-2 border-accent/40 pl-3 text-xs leading-5 text-muted-foreground">
            {source.notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
