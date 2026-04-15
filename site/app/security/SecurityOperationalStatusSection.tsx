import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import selfEvalData from "@/data/self-eval.json";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { SecurityStatusCard } from "./SecurityStatusCard";

type RuntimeDistEntry = { runtime: string; count: number };

export function SecurityOperationalStatusSection() {
  const latest = selfEvalData.latest;
  const evals = latest.evals;
  const runtimeDist = (evals.runtime_distribution ?? []) as RuntimeDistEntry[];
  const knownEvalRuntimeRuns = runtimeDist.reduce(
    (sum, entry) => (entry.runtime === "unknown" ? sum : sum + entry.count),
    0,
  );
  const totalEvalRuns = evals.runs ?? 0;
  const runtimeCoveragePct = totalEvalRuns > 0 ? Math.round((knownEvalRuntimeRuns / totalEvalRuns) * 100) : 0;

  return (
    <SiteSection cid="security-operational-status-section-site-section" tone="muted">
      <SiteSectionHeading
        icon={ShieldCheck}
        kicker="Operational status"
        kickerRowClassName="mb-6 gap-3"
        iconClassName="text-emerald-400"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SecurityStatusCard
          label="Root telemetry events"
          value={latest.totals.events.toLocaleString()}
          detail={`${latest.totals.sessions} sessions • ${latest.totals.gad_cli_calls} gad CLI calls`}
        />
        <SecurityStatusCard
          label="Tracked eval runs"
          value={String(evals.runs)}
          detail={`${evals.reviewed_runs} reviewed • ${evals.projects} projects`}
        />
        <SecurityStatusCard
          label="Eval token coverage"
          value={evals.tokens.total.toLocaleString()}
          detail={`${evals.tokens.tracked_runs} tracked runs • ${evals.tokens.missing_runs} missing`}
        />
        <SecurityStatusCard
          label="Runtime attribution"
          value={`${runtimeCoveragePct}%`}
          detail={`${knownEvalRuntimeRuns}/${totalEvalRuns} preserved runs have known runtime ids`}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current audit artifacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-sm leading-6 text-muted-foreground">
            <p>
              These are the real artifacts we can point to today. They are better than claims, but they are not yet a
              full certification program.
            </p>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/docs/ISOLATION-AUDIT-2026-04-10.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted"
                >
                  Worktree isolation audit
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/MagicbornStudios/get-anything-done/blob/main/site/data/self-eval.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted"
                >
                  self-eval operational telemetry
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/MagicbornStudios/get-anything-done/tree/main/hooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted"
                >
                  planning-file prompt guard hook
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What is still missing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-sm leading-6 text-muted-foreground">
            <p>
              The framework is not yet doing full security certification. We do not have malware-style scanning, signed
              provenance manifests, or complete historical runtime attribution across all evals.
            </p>
            <ul className="space-y-2">
              <li>Third-party skill hosting is still disabled.</li>
              <li>Historical eval runtime coverage is partial.</li>
              <li>Prompt-guard coverage is specific to planning-file writes, not all file operations.</li>
              <li>Skill certification remains a research direction, not a shipped guarantee.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </SiteSection>
  );
}

