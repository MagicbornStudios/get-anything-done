import { Badge } from "@/components/ui/badge";
import type { LineagePredecessor } from "@/app/lineage/lineage-data";
import { SiteOutboundLinkButton } from "@/components/site";

export function LineagePredecessorArticle({ predecessor }: { predecessor: LineagePredecessor }) {
  const p = predecessor;
  return (
    <article className="rounded-2xl border border-border/70 bg-card/40 p-6 md:p-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{p.name}</h3>
            <Badge variant="outline">{p.author}</Badge>
          </div>
          <p className="text-sm italic text-muted-foreground">{p.tagline}</p>
        </div>
        <SiteOutboundLinkButton href={p.url}>Visit project</SiteOutboundLinkButton>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-accent">What it contributed</p>
          <p className="mt-2 text-base leading-7 text-foreground">{p.contribution}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-accent">How GAD uses it</p>
          <p className="mt-2 text-base leading-7 text-foreground">{p.howGadUses}</p>
        </div>
      </div>
    </article>
  );
}
