import Link from "next/link";
import { GitFork, Terminal, MessageSquare, Bot, AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Contribute — GAD",
  description:
    "How to clone the repo and run your own eval. Human-first workflow — snapshot is for the agent, not for you.",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export default function ContributePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Contribute</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Clone, install,{" "}
            <span className="gradient-text">talk to the agent.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            GAD is forkable. Everything &mdash; planning state, eval results,
            decisions, the site itself &mdash; lives in the repo. To contribute
            an experiment or run your own eval, you don&apos;t need to learn the
            framework. You clone, install, and have a conversation with a coding
            agent that already has the GAD skills available.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Anchor decision: <Ref id="gad-77" /> &mdash; contribution flow is
            human-first. <Ref id="gad-74" /> &mdash; the value of GAD is task
            management at scale, not faster software shipping.
          </p>

          <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-amber-100">
              <AlertTriangle size={14} aria-hidden />
              <strong>Fresh-clone test still open</strong>
            </div>
            <p className="text-xs leading-5 text-amber-200">
              We have not yet verified the contribution flow on a clean clone in
              a new repo. The instructions below describe what{" "}
              <em>should</em> work; if you hit a missing piece (settings, hooks,
              env vars), open an issue and tag it{" "}
              <Link
                href="/questions#fresh-clone-contribution-test"
                className="text-amber-100 underline decoration-dotted"
              >
                fresh-clone-contribution-test
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Human path */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <MessageSquare size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Human workflow &mdash; what you do</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
            Five steps. Three of them are setup, two are conversation. You never
            run <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad snapshot</code>{" "}
            yourself &mdash; that&apos;s for the agent.
          </p>

          <div className="space-y-4">
            <Step
              num="1"
              title="Clone the repo"
              code={`git clone ${REPO}.git
cd get-anything-done`}
              note="Standard git clone. Pulls the framework code, planning docs, and every preserved eval."
            />
            <Step
              num="2"
              title="Install GAD skills (canonical path)"
              code={`npx skills add MagicbornStudios/get-anything-done`}
              note="Installs all GAD workspace skills to .agents/skills/ + .claude/skills/ via the open-standard skills CLI (vercel-labs/skills). Works with Claude Code, Codex, Cursor, Windsurf, and 40+ other agents. Emergent skills are excluded automatically."
            />
            <Step
              num="3"
              title="Open the repo in Claude Code (or another agent runtime)"
              note="The .claude/ directory ships with the GAD skills, agents, and hook configuration. Cursor and Codex have their own runtime directories — see the GAD installer for cross-runtime setup. Whichever you use, the agent picks up the GAD skills automatically when the repo opens."
            />
            <Step
              num="4"
              title="Talk to the agent about what you want to do"
              note="No XML editing, no manual snapshot, no learning the framework. Just describe your intent."
              examples={[
                '"Run the escape-the-dungeon-bare eval against requirements v5"',
                '"Add a new open question about the pressure score formula and cite gad-75"',
                '"I want to test a new hypothesis: do agents perform better with smaller tool budgets? Help me design an eval"',
                '"Submit a rubric review for escape-the-dungeon-emergent v5"',
              ]}
            />
            <Step
              num="5"
              title="Read the results on the site"
              note="When the agent finishes, the site picks up the new data automatically on the next prebuild. Findings, scores, and decisions are all rendered as static pages — open them in your browser and skim."
            />
          </div>
        </div>
      </section>

      {/* Agent path */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <Bot size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Agent workflow &mdash; what happens behind the scenes</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
            You don&apos;t need to follow this. It&apos;s here so you know the
            difference between human-facing and agent-facing operations.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal size={14} aria-hidden />
                  gad snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Re-hydrates context after auto-compaction. The agent runs this
                at session start to read STATE.xml, TASK-REGISTRY.xml,
                DECISIONS.xml, and the recent commit history in one shot. It
                produces output that&apos;s only useful for an agent reading
                its own mental model. Humans should{" "}
                <strong>never</strong> need to look at the output.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal size={14} aria-hidden />
                  gad eval run / preserve
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                The agent invokes these to start an eval and to preserve its
                outputs to the canonical{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                  evals/
                </code>{" "}
                directory. Preservation is enforced by tests &mdash; an
                unpreserved run fails the build.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal size={14} aria-hidden />
                  gad eval review --rubric
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                The agent (or you, if you played a build) submits a per-
                dimension rubric review. The score lands in TRACE.json under
                that run&apos;s human_review block and renders on the site
                via the prebuild.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal size={14} aria-hidden />
                  Plan / execute / verify / commit loop
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                The GAD planning loop (<Ref id="gad-18" />) the agent follows.
                One task per iteration: read snapshot, pick a task, implement
                it, update planning XML, commit. The loop survives auto-
                compaction because everything is in the repo.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What you can contribute */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <GitFork size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">What you can contribute</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ContributeCard
              title="Run an existing eval"
              description="Pick any greenfield project (escape-the-dungeon, -bare, -emergent) and run it against the current requirements version. Compare your results to ours."
              firstStep={'"Run escape-the-dungeon-bare against requirements v5"'}
            />
            <ContributeCard
              title="Test a new hypothesis"
              description="Have an idea about agent behavior? Author a new hypothesis as a decision (gad-N), draft requirements, and run it as a new round per gad-72."
              firstStep={'"I want to test whether smaller token budgets force better planning. Help me design this experiment."'}
            />
            <ContributeCard
              title="Play and review a build"
              description="Open the Playable Archive, play any scored build, and submit a rubric review. Your scores feed the site automatically."
              firstStep={'"I just played escape-the-dungeon-bare v5. Submit a rubric review with these scores: ..."'}
            />
            <ContributeCard
              title="Author or evolve a skill"
              description="Use the create-skill / merge-skill / find-skills triumvirate (gad-73). New skills land in skills/ and get cataloged on the site."
              firstStep={'"Help me author a skill for finding kaplay sprite issues. Use create-skill."'}
            />
            <ContributeCard
              title="Log a bug or open a question"
              description="Found a bug while playing? Add it to data/bugs.json. Have an open research question? Add it to data/open-questions.json. Both render on the site."
              firstStep={'"Add a bug entry: rune forge lets me select the same rune twice in escape-the-dungeon-bare v5"'}
            />
            <ContributeCard
              title="Build a new eval flavor"
              description="Add a new eval project under evals/ — content-pack injection (gad-66), brownfield extension, codex-runtime comparison. Each becomes its own track on the site."
              firstStep={'"Set up a new eval project: escape-the-dungeon-codex. Same requirements as escape-the-dungeon, but the runner is codex-cli instead of claude-code."'}
            />
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Useful starting points</p>
          <div className="space-y-3 text-sm leading-6">
            <p>
              <Button variant="link" className="h-auto gap-1 p-0 text-sm font-normal text-accent" asChild>
                <a href={REPO} target="_blank" rel="noopener noreferrer">
                  Repository on GitHub
                  <ExternalLink size={11} aria-hidden />
                </a>
              </Button>
            </p>
            <p>
              <Link
                href="/decisions"
                className="text-accent underline decoration-dotted"
              >
                Decisions
              </Link>{" "}
              &mdash; every committed decision the project has made.
            </p>
            <p>
              <Link
                href="/questions"
                className="text-accent underline decoration-dotted"
              >
                Open questions
              </Link>{" "}
              &mdash; what we&apos;re still working out. A great place to
              propose answers.
            </p>
            <p>
              <Link
                href="/requirements"
                className="text-accent underline decoration-dotted"
              >
                Requirements
              </Link>{" "}
              &mdash; what each eval is being measured against.
            </p>
            <p>
              <Link
                href="/glossary"
                className="text-accent underline decoration-dotted"
              >
                Glossary
              </Link>{" "}
              &mdash; if a term is confusing, it&apos;s here.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Step({
  num,
  title,
  code,
  note,
  examples,
}: {
  num: string;
  title: string;
  code?: string;
  note?: string;
  examples?: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="size-7 shrink-0 justify-center rounded-full border-accent/40 bg-accent/10 p-0 font-mono text-sm font-semibold normal-case tracking-normal text-accent"
          >
            {num}
          </Badge>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {code && (
          <pre className="mb-3 overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs leading-6 text-foreground/90">
            {code}
          </pre>
        )}
        {note && <p className="text-sm leading-6 text-muted-foreground">{note}</p>}
        {examples && examples.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm leading-6">
            {examples.map((e, i) => (
              <li
                key={i}
                className="rounded border border-border/40 bg-background/40 px-3 py-1.5 text-xs italic text-muted-foreground"
              >
                {e}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ContributeCard({
  title,
  description,
  firstStep,
}: {
  title: string;
  description: string;
  firstStep: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="flex items-center gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-xs italic text-accent">
          <MessageSquare size={11} className="shrink-0" aria-hidden />
          {firstStep}
        </div>
      </CardContent>
    </Card>
  );
}
