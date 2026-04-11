import Link from "next/link";
import { AlertTriangle, ExternalLink, GitBranch, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";

export const metadata = {
  title: "Lineage — GSD, RepoPlanner, GAD",
  description:
    "The problem of context rot in agent-driven development, the upstream Get Shit Done framework, the RepoPlanner precursor that formalized the Ralph Wiggum loop, and how GAD builds on both and adds measurement.",
};

const PREDECESSORS = [
  {
    name: "Get Shit Done",
    author: "gsd-build",
    url: "https://github.com/gsd-build/get-shit-done",
    tagline: "The framework GAD forked from. Cross-runtime installer + planning loop + skills.",
    contribution:
      "GSD is a full framework, not just a methodology. Ships a cross-runtime installer (bin/install.js) that can target Claude Code, Cursor, Codex, OpenCode, Gemini, Copilot, Antigravity, Windsurf, Augment — nine coding-agent runtimes with one command. Plus: a structured planning loop, visible state, executable specs, and the insight that an agent is productive when it has a tight repeatable loop plus a persistent place to put its thinking. GAD's plan → execute → verify → commit cycle is descended directly from GSD's methodology, and GAD's installer is the same install.js script inherited from the GSD fork.",
    howGadUses:
      "GAD inherits the loop shape, checkpointable state, the skills-as-durable-layer principle, AND the nine-runtime installer. Where GAD diverges: the CLI is format-agnostic (XML/MD/MDX), subagents are formalized as first-class entities with their own agents/ directory, and an evaluation framework sits alongside to test whether any of this actually helps. The eval framework is the thing you won't find in GSD upstream — it's GAD's load-bearing addition.",
  },
  {
    name: "RepoPlanner",
    author: "b2gdevs",
    url: "https://repo-planner.vercel.app/",
    tagline: "First formal attempt at the Ralph Wiggum loop — keep docs and tasks in the repo.",
    contribution:
      "The earlier project by the same author that tried to solve context rot by persisting all planning artifacts — requirements, roadmap, tasks, decisions — directly in the repository. The core insight: an agent always has context if the context is committed to git. No ephemeral memory, no external databases, no chat logs that evaporate at the context window limit.",
    howGadUses:
      "GAD keeps this principle as a load-bearing invariant. Every piece of planning state lives in .planning/ as a tracked file. `gad snapshot` rehydrates the agent in one command by reading those files. The /planning page on this site is literally a render of those same files. RepoPlanner proved the approach; GAD generalized it and added the eval harness to measure whether the approach wins.",
  },
];

export default function LineagePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Lineage</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            GAD didn&apos;t invent this. <span className="gradient-text">It builds on two approaches.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            The problem every agent-driven development framework is trying to solve is the same
            one: <strong className="text-foreground">context rot</strong>. As a coding session
            runs longer, the agent&apos;s working memory drifts. What it decided an hour ago gets
            contradicted. Decisions resurface as new questions. Half-finished work becomes invisible
            because it&apos;s buried under the next concern. Eventually the agent is confidently
            producing inconsistent code against requirements it no longer remembers.
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            Two earlier projects tried to fix this before GAD. Both are load-bearing in how GAD
            thinks about the loop, and GAD is &mdash; honestly &mdash; mostly a combination of
            their ideas plus a measurement layer stapled on.
          </p>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">The problem</p>
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Context rot in three symptoms
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decision drift</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-6 text-muted-foreground">
                  Something the agent decided at minute 5 gets quietly contradicted at minute 45.
                  Neither version is wrong in isolation, but together they&apos;re inconsistent.
                  Without a durable record of why the first call was made, the agent has no way
                  to know it should stay consistent.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invisible in-flight work</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-6 text-muted-foreground">
                  Half-done tasks disappear from the agent&apos;s working set as soon as something
                  more urgent arrives. Three sessions later, the user has to remember what was in
                  flight — the agent certainly doesn&apos;t. Context windows aren&apos;t memory,
                  they&apos;re a rolling window.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requirements slippage</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-6 text-muted-foreground">
                  The original ask gets refactored in the agent&apos;s head as the conversation
                  evolves. By the end of a long session the code satisfies something related to
                  but not exactly what was originally requested. Without a committed spec in the
                  repo, there&apos;s no authority to hold the drift accountable against.
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
            All three symptoms have the same root cause: <strong className="text-foreground">
            the agent&apos;s memory is ephemeral but the work is persistent</strong>. The fix
            every framework in this space converges on is the same: put the context in the repo,
            not in the session.
          </p>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <History size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Predecessors</p>
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Two projects GAD is downstream of
          </h2>

          <div className="mt-10 space-y-8">
            {PREDECESSORS.map((p) => (
              <article
                key={p.name}
                className="rounded-2xl border border-border/70 bg-card/40 p-6 md:p-8"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                        {p.name}
                      </h3>
                      <Badge variant="outline">{p.author}</Badge>
                    </div>
                    <p className="text-sm italic text-muted-foreground">{p.tagline}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-full border-border/70 bg-background/50 px-4 py-2 text-xs font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
                    asChild
                  >
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      Visit project
                      <ExternalLink size={12} aria-hidden />
                    </a>
                  </Button>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">
                      What it contributed
                    </p>
                    <p className="mt-2 text-base leading-7 text-foreground">{p.contribution}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">
                      How GAD uses it
                    </p>
                    <p className="mt-2 text-base leading-7 text-foreground">{p.howGadUses}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <GitBranch size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">What GAD adds</p>
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            The measurement layer
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            GSD had the loop. RepoPlanner had the in-repo persistence. Both assumed their
            approaches worked &mdash; reasonably, based on author experience and developer intuition.
            GAD assumes nothing. The eval framework is the thing you can&apos;t find in either
            predecessor: a harness that runs the same task under different workflow conditions
            (GAD, bare, emergent), scores the output with both process metrics and human review,
            and publishes the results so cross-round comparisons are auditable.
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            The{" "}
            <Link href="/findings/2026-04-08-round-3" className="text-accent hover:underline">
              freedom hypothesis
            </Link>{" "}
            is what this measurement layer is for. In round 3, the bare workflow (no framework,
            no skills, no CLI) produced a game that human reviewers rated higher than the GAD
            workflow&apos;s output. That&apos;s a result neither GSD nor RepoPlanner could
            surface, because neither had a way to test "does the framework actually help?"
            GAD forces us to confront the possibility that its own loop might be counterproductive
            on certain kinds of work &mdash; and then to redesign the experiment when the answer
            looks suspicious.
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            If you&apos;re reading this page because you want to use a framework like this one:
            start with{" "}
            <a
              href="https://github.com/gsd-build/get-shit-done"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Shit Done
            </a>{" "}
            if you want the simplest loop,{" "}
            <a
              href="https://repo-planner.vercel.app/"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              RepoPlanner
            </a>{" "}
            if the in-repo persistence is what you care about, and{" "}
            <Link href="/gad" className="text-accent hover:underline">
              GAD
            </Link>{" "}
            if you want the planning loop <em>plus</em> the ability to measure whether it&apos;s
            helping you. None of these projects are in competition. They&apos;re three angles on
            the same problem.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
