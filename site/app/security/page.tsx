import Link from "next/link";
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
  title: "Security — GAD",
  description:
    "Skill security, coding-agent attack surfaces, typosquatting, and where GAD's eval-driven certification model is headed.",
};

export default function SecurityPage() {
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
          Skills extend a coding agent&apos;s prompt with instructions it will follow &mdash;
          sometimes including the right to run commands, write files, and touch the repo. That makes
          every skill a potential threat surface. This page documents the attack vectors we&apos;re
          aware of, the mitigations baked into GAD&apos;s skill format, and where our longer-term
          certification model is headed.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Anchor decision: <Ref id="gad-70" /> (Anthropic skills guide as canonical reference) · see
          also{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            /standards
          </Link>
          , related: <Ref id="gad-73" /> (fundamental skills triumvirate) &amp;{" "}
          <Ref id="gad-74" /> (GAD&apos;s value prop includes skill security as a long-term goal).
        </SiteProse>

        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
          <strong className="text-amber-100">Important:</strong> GAD does not currently host
          third-party skills. Every skill in our catalog was authored inside this repo or inherited
          from a small set of trusted upstreams (GSD, Anthropic examples). This page describes
          attacks that apply to the broader coding-agent ecosystem so you know what to watch for
          when evaluating skills from <em>other</em> sources.
        </div>
      </SiteSection>

      {/* Attack surfaces */}
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
              description="A malicious skill includes instructions that tell the agent to ignore the user, exfiltrate credentials, or commit a backdoor. Because skills are loaded into the agent's context as trusted text, there's no runtime boundary between 'user request' and 'skill instruction'."
              mitigation="Only load skills from trusted sources. Read the SKILL.md body before inheriting it. Per Anthropic's skills guide (gad-70), frontmatter forbids XML angle brackets to reduce injection risk; GAD follows the same rule."
            />
            <AttackCard
              title="Typosquatting"
              severity="high"
              description="Attacker publishes a skill with a name that looks like a legitimate one — createskill instead of create-skill, or a lookalike Unicode character. A developer copying install instructions from a forum pulls the malicious version by mistake."
              mitigation="GAD's skill format requires kebab-case-only names and reserves 'claude' / 'anthropic' as forbidden prefixes. Fuzzy-name-collision detection is queued as a future skills-directory feature. For now: paste skill names from sources you trust, don't type them."
              examples={["reactt", "lodahs", "zustand.js", "gooogle.com", "facebok.com"]}
            />
            <AttackCard
              title="Postinstall hook abuse"
              severity="high"
              description="A skill that ships with a setup script (npm postinstall, shell wrapper, python script) can run arbitrary code on skill install. This is the classic supply-chain vector."
              mitigation="GAD skills do NOT ship with postinstall scripts. If a third-party skill does, treat it as executable code and review it before installation. Our eval preservation pipeline captures produced scripts so we can audit what a run authored."
            />
            <AttackCard
              title="Credential exfiltration"
              severity="critical"
              description="A skill that needs API keys (for an MCP server, a CI integration, a cloud service) can misuse those credentials — upload them to an attacker, use them to spin up resources, or poison a service account."
              mitigation="Skills that require credentials must declare it in frontmatter (category: mcp-enhancement per Anthropic's guide). Review what the skill does with secrets before adding them to your environment. GAD's eval runs use scoped, low-privilege tokens."
            />
            <AttackCard
              title="Silent tool-use expansion"
              severity="medium"
              description="A skill that was authored to do X quietly starts doing Y after an update. Without version pinning or a change-tracking story, the user trusts the skill based on its original purpose but gets something different."
              mitigation="GAD skills track a CHANGELOG for every update when authored in the emergent workflow. File-mutation events in the trace schema (gad-50) record exactly what a skill author changed, when, and why. Provenance per skill is queued for the skills directory refactor."
            />
            <AttackCard
              title="Over-triggering on unrelated tasks"
              severity="low"
              description="A skill with an overly broad description loads on tasks it shouldn't, consuming context budget and potentially misleading the agent. Not directly malicious, but a reliability failure that compounds."
              mitigation="Anthropic's skills guide (gad-70) names over-triggering as one of the three iteration signals. GAD skills are audited against their trigger patterns via the expected-triggers file, and the programmatic-eval gap G2 (see .planning/GAPS.md) builds automated trigger-coverage checks."
            />
          </div>
      </SiteSection>

      {/* Mitigations + what GAD does */}
      <SiteSection>
        <SiteSectionHeading
          icon={ShieldCheck}
          kicker="What GAD does today"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-emerald-400"
        />
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Frontmatter discipline</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Every GAD skill follows Anthropic&apos;s SKILL.md format{" "}
                (<Ref id="gad-70" />
                ): kebab-case name, description with triggers, no XML angle
                brackets in frontmatter, reserved name prefixes rejected. Descriptions
                use folded block scalars to survive colons without breaking parsers.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">No postinstall scripts</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                GAD skills are pure markdown + optional references under{" "}
                <code className="rounded bg-card/60 px-1 py-0.5 text-xs">
                  scripts/
                </code>
                . Scripts are explicit and the skill body has to reference them
                to run. No hidden side effects on install.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trace-event audit trail</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Every eval run records a trace of tool uses, skill invocations,
                subagent spawns, and file mutations (<Ref id="gad-50" />,{" "}
                <Ref id="gad-58" />
                ). When a skill modifies a file, that modification is captured
                in TRACE.json with a hook-emitted event.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">CHANGELOG per skill evolution</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                The emergent workflow requires a CHANGELOG.md documenting the
                disposition of every inherited skill — kept / evolved /
                deprecated / replaced. This makes skill evolution auditable
                across rounds.
              </CardContent>
            </Card>
          </div>
      </SiteSection>

      {/* Future: skill certification */}
      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={FileWarning}
          kicker="Where this is headed — skill certification"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-amber-400"
        />
        <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
            A longer-term research direction captured in ASSUMPTIONS.md: a skill
            produced <em>inside</em> this system could eventually carry a
            certification that it was built under measured pressure, passed
            provenance checks, and has a verifiable performance context. The
            certification is a claim about the skill&apos;s <strong>build
            process</strong>, not its code behavior &mdash; closer to
            &quot;signed source + reproducible build&quot; than to &quot;malware
            scan.&quot;
          </p>
          <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
            What we&apos;d need to make that work:
          </p>
          <ul className="mb-6 space-y-2 text-sm leading-6 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="text-foreground">Origin run ID</strong>{" "}
                &mdash; which eval run authored the skill, including the
                rubric scores that run achieved.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="text-foreground">Pressure tier</strong>{" "}
                (<Ref id="gad-75" />) the originating run operated under.
                Skills built under high pressure carry more weight than
                skills built under toy conditions.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="text-foreground">Inheritance lineage</strong>{" "}
                &mdash; what fundamentals the skill was merged from, via
                the gad-73 triumvirate.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="text-foreground">CHANGELOG disposition</strong>{" "}
                across inheriting runs &mdash; does the skill keep getting
                kept, or keep getting deprecated? Persistent inheritance
                is a quality signal.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="text-foreground">Signed manifest</strong>{" "}
                or content hash chain so the certification is tamper-evident.
              </span>
            </li>
          </ul>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            None of that is built yet. The data model already allows it (each
            eval run&apos;s produced artifacts are preserved under{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
              evals/&lt;project&gt;/&lt;version&gt;/
            </code>
            ), and the Ref component already resolves decision and requirement
            IDs that would feed a provenance surface. See the{" "}
            <Link
              href="/questions#skill-security-model"
              className="text-accent underline decoration-dotted"
            >
              open question
            </Link>{" "}
            on skill security for the current state of the conversation.
          </p>
      </SiteSection>

      {/* External resources */}
      <SiteSection>
        <SiteSectionHeading
          icon={AlertTriangle}
          kicker="Further reading"
          kickerRowClassName="mb-6 gap-3"
        />
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <a
              href="https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Anthropic &mdash; Complete Guide to Building Skills for Claude
              <ExternalLink size={11} aria-hidden />
            </a>
            <p className="text-xs">
              Canonical reference for SKILL.md format, frontmatter rules,
              three testing layers (triggering / functional / performance
              comparison), and the three skill categories
              (doc-creation / workflow / mcp-enhancement).
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
              <code
                key={e}
                className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-rose-300"
              >
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
