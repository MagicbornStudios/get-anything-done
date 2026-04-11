import { Download, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/components/landing/templates/templates-shared";
import { GAD_PACK_TEMPLATE } from "@/lib/eval-data";

export function TemplatesGadPack() {
  if (!GAD_PACK_TEMPLATE) return null;

  return (
    <Card className="mt-12 border-accent/40 bg-accent/5 shadow-none">
      <CardContent className="flex flex-col items-start gap-5 p-6 md:flex-row md:items-center md:gap-8 md:p-8">
        <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-accent/60 bg-background/50 text-accent">
          <Package size={24} aria-hidden />
        </div>
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight">GAD pack template</h3>
            <Badge variant="outline" className="normal-case tracking-normal">
              {formatBytes(GAD_PACK_TEMPLATE.bytes)}
            </Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Drop <code className="rounded bg-card/60 px-1 py-0.5 text-xs">templates/</code> into your
            repo, run <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad new-project</code>,
            and you&apos;re at the same starting line as every GAD project.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full shrink-0 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90 md:w-auto"
          asChild
        >
          <a href={GAD_PACK_TEMPLATE.zipPath} download>
            <Download size={16} aria-hidden />
            Download ZIP
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
