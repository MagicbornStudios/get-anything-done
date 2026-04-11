import { Download, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/components/landing/templates/templates-shared";
import { PROJECT_LABELS, type EvalTemplateAsset } from "@/lib/eval-data";

type Props = {
  template: EvalTemplateAsset;
};

export function TemplateEvalCard({ template: tpl }: Props) {
  return (
    <Card className="transition-colors hover:border-accent/60">
      <CardHeader>
        <div className="mb-2 inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-accent">
          <FileArchive size={16} aria-hidden />
        </div>
        <CardTitle className="text-base">{PROJECT_LABELS[tpl.project] ?? tpl.project}</CardTitle>
        <CardDescription className="font-mono text-xs">{tpl.project}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(tpl.bytes)}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-auto gap-2 rounded-full border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold [&_svg]:size-3"
          asChild
        >
          <a href={tpl.zipPath} download>
            <Download size={12} aria-hidden />
            ZIP
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
