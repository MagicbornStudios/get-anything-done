import Link from "next/link";
import {
  BookOpen,
  ExternalLink,
  Layers,
  AlertTriangle,
  ClipboardCheck,
  Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Standards — GAD",
  description:
    "The open standards GAD cites and conforms to: the Anthropic skills guide and the agentskills.io specification. Every skill-related page on this site links back here.",
};

const ANTHROPIC_GUIDE_URL =
  "https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf";
const AGENTSKILLS_URL = "https://agentskills.io";

export default function StandardsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Standards</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Two canonical references.{" "}
            <span className="gradient-text">Cited on every skill page.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            GAD is a research framework, not a new skill format. The way we
            author skills, evaluate them, and load them into agents follows two
            open references that already exist. This page is the single
            canonical citation point — every other skill-related page on the
            site links here rather than repeating the standards inline.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Anchor decisions: <Ref id="gad-70" /> (Anthropic guide as canonical
            reference), <Ref id="gad-80" /> (agentskills.io adoption +{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">
              .agents/skills/
            </code>{" "}
            convention), <Ref id="gad-81" /> (skill-count policy derived from
            both sources).
          </p>
        </div>
      </section>

      {/* Two reference cards */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <BookOpen size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">The two references</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="border-l-4 border-amber-500/60">
              <CardHeader className="pb-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="bg-amber-500/15 text-amber-300">
                    Anthropic
                  </Badge>
                  <Badge variant="outline">PDF</Badge>
                </div>
                <CardTitle className="text-base leading-tight">
                  The Complete Guide to Building Skills for Claude
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <p className="mb-3">
                  Anthropic&apos;s canonical document on authoring skills for
                  Claude. Covers SKILL.md format, frontmatter rules, three
                  testing layers (triggering / functional / performance
                  comparison), three skill categories
                  (doc-creation / workflow-automation / mcp-enhancement), and
                  iteration signals (under-triggering, over-triggering,
                  execution issues). Source of truth for how Claude Code loads
                  and activates skills.
                </p>
                <a
                  href={ANTHROPIC_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  Download the PDF
                  <ExternalLink size={11} aria-hidden />
                </a>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-sky-500/60">
              <CardHeader className="pb-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="bg-sky-500/15 text-sky-300">
                    Open standard
                  </Badge>
                  <Badge variant="outline">agentskills.io</Badge>
                </div>
                <CardTitle className="text-base leading-tight">
                  Agent Skills — open format + interoperability standard
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <p className="mb-3">
                  The cross-client open format for skills. Specifies the
                  SKILL.md file structure, the{" "}
                  <code className="rounded bg-card/60 px-1 py-0.5 text-xs">
                    .agents/skills/
                  </code>{" "}
                  discovery convention for cross-client interoperability,
                  progressive-disclosure three-tier loading, name collision
                  handling, trust gating, and a full per-skill evaluation
                  methodology. Agents built against this standard should find
                  each other&apos;s skills regardless of runtime.
                </p>
                <a
                  href={AGENTSKILLS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  Read the standard
                  <ExternalLink size={11} aria-hidden />
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Progressive disclosure */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <Layers size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Progressive disclosure — three tiers</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Per{" "}
            <a
              href={`${AGENTSKILLS_URL}/client-implementation/adding-skills-support`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              agentskills.io client implementation
            </a>
            , every compliant agent follows the same three-tier load strategy.
            This is what keeps skill libraries scalable — you don&apos;t pay
            the token cost of every installed skill upfront, only the ones
            actually used in a conversation.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="mb-1 w-fit">
                  tier 1
                </Badge>
                <CardTitle className="text-base">Catalog</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <p className="mb-2">
                  Name + description only. Loaded at session start.
                </p>
                <p className="text-[11px]">
                  Token cost: ~50-100 tokens per skill. 27 skills in GAD ≈
                  ~2000 tokens for the full catalog.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="mb-1 w-fit">
                  tier 2
                </Badge>
                <CardTitle className="text-base">Instructions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <p className="mb-2">
                  Full SKILL.md body. Loaded when the agent decides a skill is
                  relevant to the current task.
                </p>
                <p className="text-[11px]">
                  Token cost: &lt;5000 tokens recommended per skill.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="mb-1 w-fit">
                  tier 3
                </Badge>
                <CardTitle className="text-base">Resources</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <p className="mb-2">
                  Scripts, references, assets bundled in the skill directory.
                  Loaded on-demand when instructions reference them.
                </p>
                <p className="text-[11px]">
                  Token cost: varies — pay only for the files actually read.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Discovery + collision */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">Discovery convention — .agents/skills/</p>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            The agentskills.io cross-client interoperability convention is the
            canonical location GAD is migrating toward (
            <Ref id="gad-80" />
            ). Skills installed at these paths become visible to any compliant
            client — Claude Code, Codex, Cursor, Windsurf, Augment, and others
            — without per-runtime copies.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-card/60">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scope</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Path</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="px-4 py-3 font-mono text-xs">Project</td>
                  <td className="px-4 py-3 font-mono text-xs">&lt;project&gt;/.&lt;client&gt;/skills/</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">Client-native location</td>
                </tr>
                <tr className="border-b border-border/40 bg-sky-500/5">
                  <td className="px-4 py-3 font-mono text-xs">Project</td>
                  <td className="px-4 py-3 font-mono text-xs text-sky-300">&lt;project&gt;/.agents/skills/</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">Cross-client interoperability</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="px-4 py-3 font-mono text-xs">User</td>
                  <td className="px-4 py-3 font-mono text-xs">~/.&lt;client&gt;/skills/</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">Client-native location</td>
                </tr>
                <tr className="bg-sky-500/5">
                  <td className="px-4 py-3 font-mono text-xs">User</td>
                  <td className="px-4 py-3 font-mono text-xs text-sky-300">~/.agents/skills/</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">Cross-client interoperability</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-300" aria-hidden />
              <strong className="text-rose-200">Current GAD gap</strong>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              GAD workspace skills currently live at{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                vendor/get-anything-done/skills/
              </code>{" "}
              — the repo root. This is neither the Claude-Code-native path
              nor the cross-client{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                .agents/skills/
              </code>{" "}
              convention. Worse: <strong className="text-foreground">
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad install</code>{" "}
              does not copy workspace skills to user projects at all</strong>
              {" "}— it only installs{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                commands/gad/*.md
              </code>{" "}
              as slash commands + agents + a single bundled skill. The full
              findability writeup is at{" "}
              <a
                href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/docs/SKILL-FINDABILITY-2026-04-09.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-100 underline decoration-dotted"
              >
                .planning/docs/SKILL-FINDABILITY-2026-04-09.md
              </a>
              . Adopting the{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                .agents/skills/
              </code>{" "}
              convention is tracked as task 22-46.
            </p>
          </div>
        </div>
      </section>

      {/* Name collision */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Name collision handling</p>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Per the standard, when two skills share the same{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">name</code>{" "}
            field:{" "}
            <strong className="text-foreground">
              project-level skills override user-level skills.
            </strong>{" "}
            Within the same scope, first-found or last-found is acceptable but
            the choice must be consistent and collisions must be logged so the
            user knows a skill was shadowed. GAD adds a stronger requirement
            per <Ref id="gad-81" />: skills must answer &quot;what can this do
            that no other skill can?&quot; — if the answer is unclear, they
            are merge candidates rather than collisions. A skill-collision
            detection scan is queued as task 22-49 to catch overlapping trigger
            descriptions before they manifest as ambiguous routing at runtime.
          </p>
        </div>
      </section>

      {/* Evaluation methodology */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <Gauge size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">
              Per-skill evaluation methodology
            </p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Directly from{" "}
            <a
              href={`${AGENTSKILLS_URL}/skill-creation/evaluating-skills`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              agentskills.io/skill-creation/evaluating-skills
            </a>
            . Distinct from GAD&apos;s eval-project rubric (which scores a
            whole build like escape-the-dungeon). This methodology scores
            individual skills.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">1. Test cases in evals/evals.json</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Every skill stores its test cases alongside it. Each test has
                a prompt, an expected-output description, optional input
                files, and assertions. Start with 2-3 cases, expand after the
                first iteration.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">2. Run each case twice</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <strong className="text-foreground">
                  with_skill vs without_skill
                </strong>
                . Same prompt, same inputs, clean context. The baseline
                (no skill) is what the agent does on its own. Improving over
                baseline is what you&apos;re measuring.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">3. Capture timing</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Tokens and duration per run, stored in{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                  timing.json
                </code>
                . Lets you see the cost of the skill, not just the benefit.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">4. Grade assertions + iterate</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Each assertion gets PASS or FAIL with concrete evidence. All
                iterations aggregate into{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                  benchmark.json
                </code>{" "}
                with delta (with_skill − without_skill) per metric. The loop
                is: grade → review → propose improvements → rerun → grade.
              </CardContent>
            </Card>
          </div>
          <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
            <strong className="text-foreground">GAD adoption status:</strong>{" "}
            not yet. The per-skill methodology is queued under task 22-50 +
            the triumvirate audit. Once built, per-skill evaluation is the
            direct answer to the programmatic-eval gap{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">G2</code>{" "}
            in <Link href="/data" className="text-accent underline decoration-dotted">
              .planning/docs/GAPS.md
            </Link>{" "}
            (skill-trigger coverage) and the per-skill effectiveness half of{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">G11</code>{" "}
            (skill-inheritance hygiene).
          </p>
        </div>
      </section>

      {/* Three testing layers */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <ClipboardCheck size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">
              Three testing layers (Anthropic guide)
            </p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            From the Anthropic skills guide. Complementary to the
            agentskills.io with_skill vs without_skill methodology — this
            taxonomy distinguishes what you&apos;re testing.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="mb-1 w-fit text-[10px]">
                  layer 1
                </Badge>
                <CardTitle className="text-base">Triggering tests</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Does the skill load when it should? Test with obvious prompts,
                paraphrased prompts, and negative (unrelated) prompts. The
                skill should trigger on the first two and NOT trigger on the
                third.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="mb-1 w-fit text-[10px]">
                  layer 2
                </Badge>
                <CardTitle className="text-base">Functional tests</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Does the skill produce correct outputs? Valid outputs, API
                calls succeed, error handling works, edge cases covered. This
                is where the agentskills.io assertion-based grading fits.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="mb-1 w-fit text-[10px]">
                  layer 3
                </Badge>
                <CardTitle className="text-base">Performance comparison</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Does the skill actually improve results vs baseline? The
                with_skill vs without_skill pattern. Improvements in task
                completion rate, reduction in back-and-forth messages, fewer
                failed API calls, lower token usage.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
