import { ClipboardCheck, FlaskConical, GitBranch, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PILLARS = [
  {
    icon: Workflow,
    title: "A planning loop",
    body:
      "Snapshot → pick a task → implement → update state → commit. The same five steps every iteration. The CLI gives you the current context in one command, so the agent never spends tokens reading 15 files to remember where it was.",
  },
  {
    icon: ClipboardCheck,
    title: "Versioned requirements",
    body:
      "Every eval project has a REQUIREMENTS.xml with a version (v1 → v4). When the spec changes we publish the diff and the rationale, so a run from round 1 can be compared apples-to-apples with a run from round 4.",
  },
  {
    icon: FlaskConical,
    title: "Evaluation, not vibes",
    body:
      "Each run produces a TRACE.json with composite score, gate pass/fail, and human review weighted at 30%. Process metrics alone are not allowed to hide bad output — gad-29 made that explicit.",
  },
  {
    icon: GitBranch,
    title: "Three workflows in parallel",
    body:
      "GAD (full framework), Bare (no framework), Emergent (no framework + inherited skills). Same task, same requirements, different operating models. Round 3 gave us the freedom hypothesis: bare beat GAD on creative output.",
  },
];

export default function WhatItIs() {
  return (
    <section id="what" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">What it is</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          A small CLI, a strict planning loop,{" "}
          <span className="gradient-text">and an experiment harness</span> stapled to the side.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          GAD started as a fork of the GSD (Get Shit Done) planning approach for AI agents. Then we
          got tired of arguing about whether structured planning actually helped, so we built the
          eval framework to find out. The CLI and the evals share the same source of truth — the
          framework eats its own dogfood, phase by phase.
        </p>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="group transition-colors hover:border-accent/60">
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-accent transition-colors group-hover:border-accent/40">
                  <pillar.icon size={20} aria-hidden />
                </div>
                <CardTitle>{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-7">{pillar.body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
