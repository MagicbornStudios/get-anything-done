import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import { STATUS_CONFIG, TRACK_TINT, type HypothesisCard } from "./hypotheses-data";

export function HypothesesHypothesisCard({ h }: { h: HypothesisCard }) {
  const config = STATUS_CONFIG[h.status];
  const Icon = config.icon;
  return (
    <Card className={`border-l-4 ${TRACK_TINT[h.track] ?? "border-border/60"}`}>
      <CardHeader className="pb-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Ref id={h.decisionId} />
          <Badge variant={config.tint} className="inline-flex items-center gap-1">
            <Icon size={10} aria-hidden />
            {config.label}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {h.track}
          </Badge>
        </div>
        <CardTitle className="text-xl leading-tight">{h.name}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-4 text-sm leading-6 text-foreground/90">{h.statement}</p>
        <div className="rounded border border-border/40 bg-background/40 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Latest evidence
          </p>
          <p className="text-xs leading-5 text-muted-foreground">{h.latestEvidence}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-auto gap-1 rounded-full border-accent/40 bg-accent/5 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/15 [&_svg]:size-2.5"
            asChild
          >
            <Link href={h.detailHref}>
              Evidence page
              <ArrowRight size={11} aria-hidden />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-auto gap-1 rounded-full border-rose-500/40 bg-rose-500/5 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/15 [&_svg]:size-2.5"
            asChild
          >
            <Link href={h.skepticLink}>
              Critique
              <ArrowRight size={11} aria-hidden />
            </Link>
          </Button>
          {h.evalProject && (
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:border-accent hover:text-accent"
              asChild
            >
              <Link href={`/projects/${h.evalProject}`}>{h.evalProject}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
