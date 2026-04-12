import Link from "next/link";
import { GitFork, Terminal, MessageSquare, Bot, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";
import { CONTRIBUTE_REPO_URL } from "./contribute-constants";
import { ContributeIdeaCard } from "./ContributeIdeaCard";
import { ContributeStep } from "./ContributeStep";

export const metadata = {
  title: "Contribute — GAD",
  description:
    "How to clone the repo and run your own eval. Human-first workflow — snapshot is for the agent, not for you.",
};

export default function ContributePage() {
  return (
    <MarketingShell>
      <SiteSection>
        <SiteSectionHeading
          kicker="Contribute"
          as="h1"
          preset="hero"
          title={
            <>
              Clone, install, <span className="gradient-text">talk to the agent.</span>
            </>
          }
        />
        <SiteProse className="mt-6">
          GAD is forkable. Everything &mdash; planning state, eval results, decisions, the site itself
          &mdash; lives in the repo. To contribute an experiment or run your own eval, you don&apos;t
          need to learn the framework. You clone, install, and have a conversation with a coding agent
          that already has the GAD skills available.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Anchor decision: <Ref id="gad-77" /> &mdash; contribution flow is human-first.{" "}
          <Ref id="gad-74" /> &mdash; the value of GAD is task management at scale, not faster software
          shipping.
        </SiteProse>

        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-100">
            <AlertTriangle size={14} aria-hidden />
            <strong>Fresh-clone test still open</strong>
          </div>
          <p className="text-xs leading-5 text-amber-200">
            We have not yet verified the contribution flow on a clean clone in a new repo. The
            instructions below describe what <em>should</em> work; if you hit a missing piece (settings,
            hooks, env vars), open an issue and tag it{" "}
            <Link
              href="/questions#fresh-clone-contribution-test"
              className="text-amber-100 underline decoration-dotted"
            >
              fresh-clone-contribution-test
            </Link>
            .
          </p>
        </div>
      </SiteSection>

      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={MessageSquare}
          kicker="Human workflow — what you do"
          kickerRowClassName="mb-6 gap-3"
        />
        <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
          Five steps. Three of them are setup, two are conversation. You never run{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad snapshot</code> yourself
          &mdash; that&apos;s for the agent.
        </p>

        <div className="space-y-4">
          <ContributeStep
            num="1"
            title="Clone the repo"
            code={`git clone ${CONTRIBUTE_REPO_URL}.git
cd get-anything-done`}
            note="Standard git clone. Pulls the framework code, planning docs, and every preserved eval."
          />
          <ContributeStep
            num="2"
            title="Install GAD skills (canonical path)"
            code={`npx skills add MagicbornStudios/get-anything-done`}
            note="Installs all GAD workspace skills to skills/ + .claude/skills/ via the open-standard skills CLI (vercel-labs/skills). Works with Claude Code, Codex, Cursor, Windsurf, and 40+ other agents. Emergent skills are excluded automatically."
          />
          <ContributeStep
            num="3"
            title="Open the repo in Claude Code (or another agent runtime)"
            note="The .claude/ directory ships with the GAD skills, agents, and hook configuration. Cursor and Codex have their own runtime directories — see the GAD installer for cross-runtime setup. Whichever you use, the agent picks up the GAD skills automatically when the repo opens."
          />
          <ContributeStep
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
          <ContributeStep
            num="5"
            title="Read the results on the site"
            note="When the agent finishes, the site picks up the new data automatically on the next prebuild. Findings, scores, and decisions are all rendered as static pages — open them in your browser and skim."
          />
        </div>
      </SiteSection>

      <SiteSection>
        <SiteSectionHeading
          icon={Bot}
          kicker="Agent workflow — what happens behind the scenes"
          kickerRowClassName="mb-6 gap-3"
        />
        <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
          You don&apos;t need to follow this. It&apos;s here so you know the difference between
          human-facing and agent-facing operations.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal size={14} aria-hidden />
                gad snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              Re-hydrates context after auto-compaction. The agent runs this at session start to read
              STATE.xml, TASK-REGISTRY.xml, DECISIONS.xml, and the recent commit history in one shot. It
              produces output that&apos;s only useful for an agent reading its own mental model. Humans
              should <strong>never</strong> need to look at the output.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal size={14} aria-hidden />
                gad eval run / preserve
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              The agent invokes these to start an eval and to preserve its outputs to the canonical{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">evals/</code> directory.
              Preservation is enforced by tests &mdash; an unpreserved run fails the build.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal size={14} aria-hidden />
                gad eval review --rubric
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              The agent (or you, if you played a build) submits a per- dimension rubric review. The
              score lands in TRACE.json under that run&apos;s human_review block and renders on the site
              via the prebuild.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal size={14} aria-hidden />
                Plan / execute / verify / commit loop
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              The GAD planning loop (<Ref id="gad-18" />) the agent follows. One task per iteration:
              read snapshot, pick a task, implement it, update planning XML, commit. The loop survives
              auto- compaction because everything is in the repo.
            </CardContent>
          </Card>
        </div>
      </SiteSection>

      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={GitFork}
          kicker="What you can contribute"
          kickerRowClassName="mb-6 gap-3"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <ContributeIdeaCard
            title="Run an existing eval"
            description="Pick any greenfield project (escape-the-dungeon, -bare, -emergent) and run it against the current requirements version. Compare your results to ours."
            firstStep={'"Run escape-the-dungeon-bare against requirements v5"'}
          />
          <ContributeIdeaCard
            title="Test a new hypothesis"
            description="Have an idea about agent behavior? Author a new hypothesis as a decision (gad-N), draft requirements, and run it as a new round per gad-72."
            firstStep={
              '"I want to test whether smaller token budgets force better planning. Help me design this experiment."'
            }
          />
          <ContributeIdeaCard
            title="Play and review a build"
            description="Open the Playable Archive, play any scored build, and submit a rubric review. Your scores feed the site automatically."
            firstStep={
              '"I just played escape-the-dungeon-bare v5. Submit a rubric review with these scores: ..."'
            }
          />
          <ContributeIdeaCard
            title="Author or evolve a skill"
            description="Use the create-skill / merge-skill / find-skills triumvirate (gad-73). New skills land in skills/ and get cataloged on the site."
            firstStep={'"Help me author a skill for finding kaplay sprite issues. Use create-skill."'}
          />
          <ContributeIdeaCard
            title="Log a bug or open a question"
            description="Found a bug while playing? Add it to data/bugs.json. Have an open research question? Add it to data/open-questions.json. Both render on the site."
            firstStep={
              '"Add a bug entry: rune forge lets me select the same rune twice in escape-the-dungeon-bare v5"'
            }
          />
          <ContributeIdeaCard
            title="Build a new eval flavor"
            description="Add a new eval project under evals/ — content-pack injection (gad-66), brownfield extension, codex-runtime comparison. Each becomes its own track on the site."
            firstStep={
              '"Set up a new eval project: escape-the-dungeon-codex. Same requirements as escape-the-dungeon, but the runner is codex-cli instead of claude-code."'
            }
          />
        </div>
      </SiteSection>

      <SiteSection>
        <SiteSectionHeading kicker="Useful starting points" />
        <div className="mt-4 space-y-3 text-sm leading-6">
          <p>
            <Button variant="link" className="h-auto gap-1 p-0 text-sm font-normal text-accent" asChild>
              <a href={CONTRIBUTE_REPO_URL} target="_blank" rel="noopener noreferrer">
                Repository on GitHub
                <ExternalLink size={11} aria-hidden />
              </a>
            </Button>
          </p>
          <p>
            <Link href="/decisions" className="text-accent underline decoration-dotted">
              Decisions
            </Link>{" "}
            &mdash; every committed decision the project has made.
          </p>
          <p>
            <Link href="/questions" className="text-accent underline decoration-dotted">
              Open questions
            </Link>{" "}
            &mdash; what we&apos;re still working out. A great place to propose answers.
          </p>
          <p>
            <Link href="/requirements" className="text-accent underline decoration-dotted">
              Requirements
            </Link>{" "}
            &mdash; what each eval is being measured against.
          </p>
          <p>
            <Link href="/glossary" className="text-accent underline decoration-dotted">
              Glossary
            </Link>{" "}
            &mdash; if a term is confusing, it&apos;s here.
          </p>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
