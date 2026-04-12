import Link from "next/link";
import selfEvalData from "@/data/self-eval.json";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Security - GAD",
  description:
    "Operational security telemetry, coding-agent attack surfaces, and where GAD's eval-driven certification model is headed.",
};

export default function SecurityPage() {
  const latest = selfEvalData.latest;
  const evals = latest.evals;
  const knownEvalRuntimeRuns = (evals.runtime_distribution ?? []).reduce(
    (sum, entry) => (entry.runtime === "unknown" ? sum : sum + entry.count),
    0,
  );
  const totalEvalRuns = evals.runs ?? 0;
  const runtimeCoveragePct = totalEvalRuns > 0 ? Math.round((knownEvalRuntimeRuns / totalEvalRuns) * 100) : 0;

  return (
    <MarketingShell>
      <SiteSection>
        <SiteSectionHeading
          kicker="Security"
          as="h1"
          preset="hero"
          title={
            <>
              Skills are code. <span className="gradient-text">Code is a threat surface.</span>
            </>
          }
        />
        <SiteProse className="mt-6">
          Skills extend a coding agent&apos;s prompt with instructions it will follow, sometimes
          including the right to run commands, write files, and touch the repo. That makes every
          skill a potential threat surface. This page does two jobs: it explains the threat model,
          and it shows the operational telemetry and audit artifacts backing the framework&apos;s
          current claims.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Anchor decision: <Ref id="gad-70" /> (Anthropic skills guide as canonical reference) · see
          also{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            /standards
          </Link>
          , related: <Ref id="gad-73" /> (fundamental skills triumvirate) and <Ref id="gad-74" />{" "}
          (skill security as a long-term goal).
        </SiteProse>

        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
          <strong className="text-amber-100">Important:</strong> GAD does not currently host
          third-party skills. Every skill in our catalog was authored inside this repo or inherited
          from a small set of trusted upstreams. This page describes attacks that apply to the
          broader coding-agent ecosystem so you know what to watch for when evaluating skills from{" "}
          <em>other</em> sources.
        </div>
      </SiteSection>

      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={ShieldCheck}
          kicker="Operational status"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-emerald-400"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            label="Root telemetry events"
            value={latest.totals.events.toLocaleString()}
            detail={`${latest.totals.sessions} sessions • ${latest.totals.gad_cli_calls} gad CLI calls`}
          />
          <StatusCard
            label="Tracked eval runs"
            value={String(evals.runs)}
            detail={`${evals.reviewed_runs} reviewed • ${evals.projects} projects`}
          />
          <StatusCard
            label="Eval token coverage"
            value={evals.tokens.total.toLocaleString()}
            detail={`${evals.tokens.tracked_runs} tracked runs • ${evals.tokens.missing_runs} missing`}
          />
          <StatusCard
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
                These are the real artifacts we can point to today. They are better than claims, but
                they are not yet a full certification program.
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
                The framework is not yet doing full security certification. We do not have
                malware-style scanning, signed provenance manifests, or complete historical runtime
                attribution across all evals.
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

      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={ShieldAlert}
          kicker="Attack surfaces"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-rose-400"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <AttackCard
            title="Prompt injection via skill body"
            severity="high"
            description="A malicious skill includes instructions that tell the agent to ignore the user, exfiltrate credentials, or commit a backdoor. Because skills are loaded into the agent's context as trusted text, there is no runtime boundary between user request and skill instruction."
            mitigation="Only load skills from trusted sources. Read the SKILL.md body before inheriting it. Per Anthropic's skills guide (gad-70), frontmatter forbids XML angle brackets to reduce injection risk; GAD follows the same rule."
          />
          <AttackCard
            title="Typosquatting"
            severity="high"
            description="An attacker publishes a skill with a name that looks like a legitimate one: createskill instead of create-skill, or a lookalike Unicode character. A developer copying install instructions from a forum pulls the malicious version by mistake."
            mitigation="GAD's skill format requires kebab-case-only names and reserves claude and anthropic as forbidden prefixes. Fuzzy-name-collision detection is queued as a future skills-directory feature. For now, paste skill names from sources you trust."
            examples={["reactt", "lodahs", "zustand.js", "gooogle.com", "facebok.com"]}
          />
          <AttackCard
            title="Postinstall hook abuse"
            severity="high"
            description="A skill that ships with a setup script can run arbitrary code on install. This is the classic supply-chain vector."
            mitigation="GAD skills do not ship with postinstall scripts. If a third-party skill does, treat it as executable code and review it before installation."
          />
          <AttackCard
            title="Credential exfiltration"
            severity="critical"
            description="A skill that needs API keys for an MCP server, CI integration, or cloud service can misuse those credentials by uploading them elsewhere, spinning resources, or poisoning a service account."
            mitigation="Skills that require credentials must declare it in frontmatter. Review what the skill does with secrets before adding them to your environment. GAD eval runs should use scoped, low-privilege tokens."
          />
          <AttackCard
            title="Silent tool-use expansion"
            severity="medium"
            description="A skill that was authored to do X quietly starts doing Y after an update. Without version pinning or a change-tracking story, the user trusts the skill based on its original purpose but gets something different."
            mitigation="GAD tracks skill evolution with changelogs and trace data. That is an audit trail, not a sandbox. You still need provenance and review."
          />
          <AttackCard
            title="Over-triggering on unrelated tasks"
            severity="low"
            description="A skill with an overly broad description loads on tasks it should not, consuming context budget and potentially misleading the agent."
            mitigation="This is a reliability problem more than a direct exploit. Trigger coverage and collision scans are the long-term mitigation path."
          />
        </div>
      </SiteSection>

      <SiteSection>
        <SiteSectionHeading
          icon={ShieldCheck}
          kicker="What GAD does today"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-emerald-400"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            title="Frontmatter discipline"
            body="Every GAD skill follows Anthropic's SKILL.md format: kebab-case name, description with triggers, no XML angle brackets in frontmatter, and reserved name prefixes rejected."
          />
          <InfoCard
            title="No postinstall scripts"
            body="GAD skills are markdown plus explicit references. No hidden side effects on install."
          />
          <InfoCard
            title="Trace-event audit trail"
            body="Eval runs record tool uses, skill invocations, subagent spawns, and file mutations. That makes post-run audit possible even when the run result is bad."
          />
          <InfoCard
            title="Isolation audit"
            body="There is now a concrete worktree isolation audit in the repo, which is more honest than just claiming eval isolation."
          />
        </div>
      </SiteSection>

      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={FileWarning}
          kicker="Where this is headed - skill certification"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-amber-400"
        />
        <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
          A longer-term research direction is a certification model for skills produced inside this
          system. That would be a claim about the build process and provenance of the skill, not a
          blanket claim that the skill is safe in every environment.
        </p>
        <ul className="mb-6 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>Origin run ID and rubric context.</li>
          <li>Pressure tier of the run that produced the skill.</li>
          <li>Inheritance lineage and changelog disposition over time.</li>
          <li>Signed manifests or tamper-evident content hashes.</li>
        </ul>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          None of that is built yet. See the{" "}
          <Link href="/questions#skill-security-model" className="text-accent underline decoration-dotted">
            open question
          </Link>{" "}
          for the current state of that work.
        </p>
      </SiteSection>

      <SiteSection>
        <SiteSectionHeading icon={AlertTriangle} kicker="Further reading" kickerRowClassName="mb-6 gap-3" />
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <a
            href="https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Anthropic - Complete Guide to Building Skills for Claude
            <ExternalLink size={11} aria-hidden />
          </a>
          <p className="text-xs">
            Canonical reference for SKILL.md format, frontmatter rules, testing layers, and skill
            categories.
          </p>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}

function AttackCard({
  title,
  severity,
  description,
  mitigation,
  examples,
}: {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation: string;
  examples?: string[];
}) {
  const sevTint =
    severity === "critical" || severity === "high"
      ? "danger"
      : severity === "medium"
        ? "default"
        : "outline";
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant={sevTint}>{severity}</Badge>
        </div>
        <CardTitle className="text-base leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
        <p>{description}</p>
        {examples && examples.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1 text-[11px]">
            <span className="text-muted-foreground/70">examples:</span>
            {examples.map((e) => (
              <code key={e} className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-rose-300">
                {e}
              </code>
            ))}
          </p>
        )}
        <p className="mt-3 border-l-2 border-emerald-500/60 pl-3 text-xs leading-5 text-muted-foreground">
          <strong className="text-emerald-300">Mitigation:</strong> {mitigation}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
