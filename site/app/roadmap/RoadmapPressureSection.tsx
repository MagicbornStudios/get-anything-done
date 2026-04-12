import Link from "next/link";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { pressureForRound, ROADMAP_PRESSURE_ROUNDS } from "./roadmap-shared";

export default function RoadmapPressureSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={Flame}
        kicker="Pressure progression"
        iconClassName="text-amber-400"
        kickerRowClassName="mb-6 gap-3"
      />
      <SiteProse size="sm" className="mb-6">
        Self-assessed pressure per round on a 0.0 – 1.0 scale aggregating requirement complexity,
        ambiguity, constraint density, iteration budget, and failure cost (see decision{" "}
        <Link href="/decisions#gad-75" className="text-accent underline decoration-dotted">
          gad-75
        </Link>
        ).
      </SiteProse>
      <div className="space-y-3">
        {ROADMAP_PRESSURE_ROUNDS.map((round) => {
          const p = pressureForRound(round);
          if (!p) return null;
          const pct = Math.round(p.value * 100);
          return (
            <div
              key={round}
              className="grid grid-cols-[80px_1fr_60px_auto] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[100px_1fr_80px_auto]"
            >
              <div>
                <div className="font-mono text-xs text-foreground">{round}</div>
                <div className="text-[10px] text-muted-foreground">{p.tier}</div>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 via-amber-400/70 to-rose-500/80"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
              <div className="text-right font-mono text-sm tabular-nums text-foreground">
                {p.value.toFixed(2)}
              </div>
              <Badge
                variant={p.source === "computed" ? "success" : "outline"}
                className="text-[9px]"
              >
                {p.source}
              </Badge>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        <strong className="text-foreground">Data provenance:</strong> rounds 4 and 5 show{" "}
        <strong className="text-emerald-300">computed</strong> values — derived programmatically from
        the REQUIREMENTS.xml structure via{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">computeTaskPressure()</code> in{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">build-site-data.mjs</code>. Formula
        (decision{" "}
        <Link href="/decisions#gad-79" className="text-accent underline decoration-dotted">
          gad-79
        </Link>
        ):{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">
          raw = R + 2*G + C; score = log2(raw+1) / log2(65)
        </code>{" "}
        where R = requirement elements, G = gates, C = amends cross-cuts. Rounds 1-3 show{" "}
        <strong className="text-muted-foreground">authored</strong> values because their
        REQUIREMENTS.xml templates were not preserved — those will become computed once the
        historical XMLs are reconstructed.
      </p>
    </SiteSection>
  );
}
