import Link from "next/link";
import { AlertTriangle, FileJson } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TRACE_FIELDS } from "@/app/methodology/methodology-shared";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyTraceSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="MethodologyTraceHeading">
        <SiteSectionHeading
          icon={FileJson}
          kicker="Trace schema"
          title="What&apos;s in TRACE.json (and what&apos;s missing)"
        />
        <SiteProse size="md" className="mt-3">
        Every eval run writes a{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> sidecar next to
        the run artifacts. The current schema is v3. Fields below describe what it         contains today.
        </SiteProse>
      </Identified>

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {TRACE_FIELDS.map((f) => (
          <Identified key={f.name} as={`MethodologyTraceFieldCard-${f.name}`}>
            <Card>
            <CardHeader>
              <CardDescription className="font-mono text-[11px]">{f.name}</CardDescription>
              <CardTitle className="text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-6 text-muted-foreground">{f.description}</p>
            </CardContent>
          </Card>
          </Identified>
        ))}
      </div>

      <Identified as="MethodologyTraceKnownGaps" className="mt-10 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Known tracing gaps (decision gad-50)
          </p>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-foreground">
          <li>
            <strong>skill_accuracy is lossy.</strong> Some runs store the full{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">expected_triggers</code> array (v5
            GAD runs do). Others store only the aggregate number. When only the aggregate is present,
            we can&apos;t tell which of the expected skills fired vs missed — see the &quot;tracing
            gap&quot; callout on the per-run page.
          </li>
          <li>
            <strong>Tool calls are not recorded.</strong> The current schema knows how many tools the
            agent used in aggregate (
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">token_usage.tool_uses</code>) but
            not which tools, in what order, against which files.
          </li>
          <li>
            <strong>Subagent spawns are not recorded.</strong> If a command delegated work to{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad-planner</code> or{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad-phase-researcher</code>, that
            delegation is invisible in the trace.
          </li>
          <li>
            <strong>Framework version is not stamped.</strong> Two runs may have different scores
            because the framework changed between them, not because the agent got better or worse —
            and today there&apos;s no way to tell from the TRACE alone.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Phase 25 ships trace schema v4 to close all four gaps.{" "}
          <Link href="/planning" className="text-accent hover:underline">
            See the roadmap on /planning →
          </Link>
        </p>
      </Identified>
    </SiteSection>
  );
}
