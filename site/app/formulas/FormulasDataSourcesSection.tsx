import { Card, CardContent } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import { SiteSection, SiteSectionHeading, SiteProse } from "@/components/site";

export function FormulasDataSourcesSection() {
  return (
    <SiteSection className="border-t border-border/60">
      <SiteSectionHeading kicker="Data sources" title="Where the numbers come from" />
      <SiteProse className="mt-5 max-w-4xl">
        All formulas run during the site prebuild (
        <code className="rounded bg-card/60 px-1 text-accent">site/scripts/compute-self-eval.mjs</code>) against these
        inputs:
      </SiteProse>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <code className="text-xs font-mono text-accent">.planning/TASK-REGISTRY.xml</code>
            <p className="mt-1 text-xs text-muted-foreground">Tasks per phase — feeds pressure</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <code className="text-xs font-mono text-accent">.planning/ROADMAP.xml</code>
            <p className="mt-1 text-xs text-muted-foreground">Phase titles + statuses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <code className="text-xs font-mono text-accent">.planning/DECISIONS.xml</code>
            <p className="mt-1 text-xs text-muted-foreground">Decision count</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <code className="text-xs font-mono text-accent">.planning/.gad-log/*.jsonl</code>
            <p className="mt-1 text-xs text-muted-foreground">Tool call traces — feeds overhead + loop compliance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <code className="text-xs font-mono text-accent">site/data/self-eval-config.json</code>
            <p className="mt-1 text-xs text-muted-foreground">All tunable weights + thresholds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <code className="text-xs font-mono text-accent">site/data/self-eval.json</code>
            <p className="mt-1 text-xs text-muted-foreground">Output — append-only snapshots over time</p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Related decisions: <Ref id="gad-75" />, <Ref id="gad-79" />, <Ref id="gad-95" />, <Ref id="gad-103" />,{" "}
        <Ref id="gad-115" />, <Ref id="gad-144" />, <Ref id="gad-145" />
      </p>
    </SiteSection>
  );
}
