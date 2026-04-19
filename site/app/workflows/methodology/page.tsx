export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import {
  Activity,
  Filter,
  GitBranch,
  Layers,
  Sigma,
  Workflow,
} from "lucide-react";
import {
  MarketingShell,
  SiteProse,
  SiteSection,
  SiteSectionHeading,
  SiteTextCard,
} from "@/components/site";
import { WorkflowMermaidDiagram } from "@/components/workflow/WorkflowMermaidDiagram";

/**
 * Task 42.3-17: workflow methodology — public-facing explanation of how the
 * detector actually works. Until this page existed, the methodology lived
 * only in DECISIONS.xml (gad-173, gad-175, gad-178) and
 * .planning/workflows/README.md, neither of which a marketplace visitor
 * can navigate to. This page makes the /planning Workflows tab legible
 * to readers other than the operator.
 *
 * Reflects the v2 model (skill-level mining, decision gad-178). v1
 * tool-level mining is described as the historical shortcut, not the
 * current detector.
 */

export const metadata: Metadata = {
  title: "Workflows — Methodology — GAD",
  description:
    "How the GAD workflow detector works: trace event schema, scope classification, participant matching, conformance scoring, skill-level vs tool-level mining, and the authored / emergent / noise display.",
};

const PIPELINE_DIAGRAM = `flowchart LR
  Hook["Trace hook<br/>(.claude/hooks +<br/>bin/gad-trace-hook.cjs)"]
    --> Jsonl[".trace-events.jsonl<br/>append-only stream"]
  Jsonl --> Scope["scope classifier<br/>(decision gad-175)"]
  Scope -->|gad-framework| Synth["skill-level<br/>synthesizer<br/>(decision gad-178)"]
  Scope -->|eval-agent| Per[per-generation<br/>synthesis]
  Synth --> Authored["authored<br/>workflows<br/>matched"]
  Synth --> Emergent["emergent<br/>candidates<br/>(skill chains)"]
  Synth --> Noise["tool-level<br/>noise & gaps"]
  Authored --> Conf["workflow_conformance<br/>= matched − extra − OOO<br/>÷ expected (gad-173)"]
  Authored --> Display
  Emergent --> Display
  Noise --> Display
  Conf --> Display["/planning Workflows tab<br/>+ planning-graph.json"]
`;

const SAMPLE_TRACE_EVENT = `{
  "ts": "2026-04-18T22:14:08.713Z",
  "session_id": "s-mo4yewyo-wfm3",
  "scope": "gad-framework",
  "event": "skill_use",
  "skill": "gad-execute-phase",
  "agent": "default",
  "cwd": "C:/Users/benja/Documents/custom_portfolio",
  "phase": "44",
  "task": "44-09"
}`;

const SAMPLE_AUTHORED_WORKFLOW = `---
slug: gad-decide
name: GAD Decide
description: Structured decision pattern — open question →
  options → pros/cons → recommendation → commit.
trigger: User asks an open question with multiple viable answers.
participants:
  skills: []
  agents: [default]
  cli: [gad decisions]
  artifacts: [.planning/DECISIONS.xml]
parent-workflow: gad-discuss-plan-execute
related-phases: [42.3]
---`;

export default function WorkflowsMethodologyPage() {
  return (
    <MarketingShell>
      <SiteSection cid="WorkflowsMethodologyHero">
        <div className="mx-auto max-w-3xl py-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <Workflow size={12} aria-hidden /> workflows · methodology
          </div>
          <h1 className="text-display">How the workflow detector works</h1>
          <p className="mt-4 text-base text-muted-foreground">
            The /planning Workflows tab shows three things at once: workflows
            you authored, workflows the system inferred from agent behavior,
            and tool-level noise that hasn't earned a name yet. This page
            explains how each one is computed, what the conformance number
            means, and why skill-level events drove a v1 → v2 rewrite.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground/80">
            <a
              className="rounded border border-border/50 px-3 py-1 hover:border-accent/50 hover:text-foreground"
              href="/planning?tab=workflows"
            >
              Live: Workflows tab →
            </a>
            <a
              className="rounded border border-border/50 px-3 py-1 hover:border-accent/50 hover:text-foreground"
              href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/workflows/README.md"
              rel="noreferrer"
              target="_blank"
            >
              Source: workflows/README.md ↗
            </a>
          </div>
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyPipeline">
        <SiteSectionHeading
          icon={GitBranch}
          kicker="The pipeline"
          title="From hook to display"
        />
        <SiteProse>
          <p>
            Every step has a trace artifact, every artifact has a writer, and
            every writer is decision-gated. The diagram below is the actual
            flow in production — no boxes are aspirational.
          </p>
        </SiteProse>
        <div className="mt-6 rounded-lg border border-border/40 bg-card/30 p-4">
          <WorkflowMermaidDiagram
            slug="methodology-pipeline"
            source={PIPELINE_DIAGRAM}
          />
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyTraceSchema">
        <SiteSectionHeading
          icon={Activity}
          kicker="Step 1 · raw signal"
          title="Trace event schema"
        />
        <SiteProse>
          <p>
            The hook layer is the only thing in the pipeline that touches the
            outside world. It listens for every tool call, skill invocation,
            agent spawn, and CLI command and appends one JSONL line per
            event to <code>.planning/.trace-events.jsonl</code>. The file is
            append-only and the synthesizer treats it as the authoritative
            stream — never the planning XML, never the catalog generated.ts.
          </p>
        </SiteProse>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SiteTextCard
            title="Sample event"
            body={
              <pre className="overflow-x-auto rounded bg-background/60 p-3 font-mono text-[11px] text-foreground/80">
                {SAMPLE_TRACE_EVENT}
              </pre>
            }
          />
          <SiteTextCard
            title="Required fields"
            body={
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>
                  <code className="text-foreground/80">ts</code> — ISO timestamp,
                  monotonic per session
                </li>
                <li>
                  <code className="text-foreground/80">session_id</code> — one
                  agent session per id (default + subagents share)
                </li>
                <li>
                  <code className="text-foreground/80">scope</code> — see step 2
                  below; defaults to <code>gad-framework</code> when omitted
                </li>
                <li>
                  <code className="text-foreground/80">event</code> — one of{" "}
                  <code>tool_use</code>, <code>skill_use</code>,{" "}
                  <code>agent_spawn</code>, <code>cli_call</code>,{" "}
                  <code>workflow_enter</code>, <code>workflow_exit</code>,{" "}
                  <code>file_edit</code>
                </li>
                <li>
                  <code className="text-foreground/80">cwd</code> — used by the
                  scope classifier when no explicit scope is set
                </li>
              </ul>
            }
          />
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyScope" tone="muted">
        <SiteSectionHeading
          icon={Filter}
          kicker="Step 2 · scope classification"
          title="Filter by what the agent was actually working on"
        />
        <SiteProse>
          <p>
            A single trace file at the GAD repo root sees events from every
            cwd the hooks fire in. That includes agents working{" "}
            <em>inside</em> eval worktrees (escape-the-dungeon, app-forge,
            etc.). Game-dev activity inside a generation is{" "}
            <em>not</em> GAD-framework activity and must not contribute to
            GAD's own emergent-workflow mining or its{" "}
            <code>workflow_conformance</code> score.
          </p>
          <p>
            Decision <a href="#refs">gad-175</a> resolves this with a{" "}
            <code>scope</code> field on every event. The synthesizer consumes
            only <code>gad-framework</code>-scoped events. Other scopes get
            their own per-project synthesis runs.
          </p>
        </SiteProse>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SiteTextCard
            title="gad-framework"
            body={
              <p className="text-xs text-muted-foreground">
                Real work on GAD itself — planning files, lib/, bin/, site/
                edits, gad CLI calls from the repo root.
              </p>
            }
          />
          <SiteTextCard
            title="eval-agent"
            body={
              <p className="text-xs text-muted-foreground">
                Work inside an eval worktree or preservation path. Detected by{" "}
                <code>.claude/worktrees/</code>, <code>/worktrees/agent-*</code>
                , or <code>/evals/&lt;project&gt;/game/</code> in the cwd.
              </p>
            }
          />
          <SiteTextCard
            title="brood-project"
            body={
              <p className="text-xs text-muted-foreground">
                Per-project planning surfaces (planning-app, project editors).
                Each registered project gets its own scope tag so synthesis
                stays clean across projects.
              </p>
            }
          />
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyAuthored">
        <SiteSectionHeading
          icon={Workflow}
          kicker="Step 3 · authored workflows"
          title="Designed in advance, matched against actual"
        />
        <SiteProse>
          <p>
            Authored workflows live as <code>.planning/workflows/&lt;slug&gt;.md</code>{" "}
            files. Each one has YAML frontmatter that declares the participants
            (skills, agents, CLI commands, artifacts that MUST appear) and a
            single mermaid diagram describing the expected sequence. Mermaid
            stays the right tool here because the graph is hand-designed and
            small (~8-12 nodes max).
          </p>
        </SiteProse>
        <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
          <SiteTextCard
            title="Frontmatter shape"
            body={
              <pre className="overflow-x-auto rounded bg-background/60 p-3 font-mono text-[11px] text-foreground/80">
                {SAMPLE_AUTHORED_WORKFLOW}
              </pre>
            }
          />
          <SiteTextCard
            title="Participant matching"
            body={
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>
                  <strong className="text-foreground/85">skill</strong> — any{" "}
                  <code>skill_use</code> with a matching slug
                </li>
                <li>
                  <strong className="text-foreground/85">agent</strong> — any{" "}
                  <code>agent_spawn</code> for that role, plus{" "}
                  <code>default</code> session itself
                </li>
                <li>
                  <strong className="text-foreground/85">cli</strong> —{" "}
                  <code>cli_call</code> events whose argv prefix matches
                </li>
                <li>
                  <strong className="text-foreground/85">artifact</strong> —{" "}
                  <code>file_edit</code> whose path starts with the declared
                  prefix
                </li>
                <li className="pt-1 text-muted-foreground/80">
                  Match position is the topological order in the expected graph,
                  not raw timestamp order — concurrent steps may interleave.
                </li>
              </ul>
            }
          />
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyConformance" tone="muted">
        <SiteSectionHeading
          icon={Sigma}
          kicker="Step 4 · conformance"
          title="The validator IS the diff"
        />
        <SiteProse>
          <p>
            Decision <a href="#refs">gad-173</a> closed three open questions
            about workflows at once. The relevant one for this page: there is
            no separate validator schema. The validator is the structural diff
            between the expected graph (authored mermaid) and the actual graph
            (skill events ordered by topological match).
          </p>
        </SiteProse>
        <div className="mt-6 rounded-lg border border-border/40 bg-card/30 p-6 text-center">
          <pre className="inline-block text-left font-mono text-sm text-foreground/90">
            {`workflow_conformance =
  (matching_nodes − extra_nodes − out_of_order_nodes)
   ÷ expected_nodes`}
          </pre>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
          <div>
            <strong className="text-foreground/85">matching_nodes</strong> —
            actual node matches an expected node by participant identity AND
            topological position.
          </div>
          <div>
            <strong className="text-foreground/85">extra_nodes</strong> —
            actual nodes with no expected counterpart. Often a sign the
            workflow needs a step added, not that the run was wrong.
          </div>
          <div>
            <strong className="text-foreground/85">out_of_order_nodes</strong> —
            actual nodes that match an expected node but ran before/after their
            expected predecessors/successors.
          </div>
        </div>
        <SiteProse>
          <p className="mt-6">
            Score is advisory. Negative scores clamp to zero. When every run
            deviates the same way, the expected graph is wrong and should be
            re-authored. When one run deviates, that run is worth investigating.
            Drift is a tuning input, not a fault.
          </p>
        </SiteProse>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologySkillLevel">
        <SiteSectionHeading
          icon={Layers}
          kicker="Step 5 · skill-level mining (v2)"
          title="Skills define workflows. Tools don't."
        />
        <SiteProse>
          <p>
            The first mining pass (v1) grouped <code>tool_use</code> events
            because that was the only signal the trace schema carried. Its
            top "patterns" were noise:{" "}
            <code>Bash → Bash → Bash × 271</code> and{" "}
            <code>Read → Edit → Edit × 26</code> describe the mechanics of
            editing, not what the agent was trying to accomplish.
          </p>
          <p>
            Decision <a href="#refs">gad-178</a> reframed the problem. A
            workflow is identified by the sequence of <em>skills</em> used
            and the order they're used in. <code>check-todos →
            task-checkpoint → gad-execute-phase</code> means something.{" "}
            <code>Bash × 271</code> doesn't.
          </p>
        </SiteProse>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SiteTextCard
            title="v1 — tool-level (historical)"
            body={
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>Mines <code>tool_use</code> sequences directly.</li>
                <li>Top patterns: <code>Bash × N</code>, <code>Read → Edit</code>.</li>
                <li>Surfaced as candidates labeled "v1 tool-level patterns".</li>
                <li>Kept as a <em>noise filter</em> input, not a workflow source.</li>
              </ul>
            }
          />
          <SiteTextCard
            title="v2 — skill-level (current)"
            body={
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>Mines <code>skill_use</code> events as the primary signal.</li>
                <li>
                  Tool events get attributed to the skill context that produced
                  them.
                </li>
                <li>
                  Recognizes patterns from <strong>how skills are used over
                  time</strong> — temporal chains, co-occurrence, skill-to-artifact
                  correlation.
                </li>
                <li>
                  Tool-level patterns that survive v2 filtering are real noise
                  signals — either a missing skill or mechanical churn.
                </li>
              </ul>
            }
          />
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyDisplay" tone="muted">
        <SiteSectionHeading
          icon={Workflow}
          kicker="Step 6 · the display"
          title="Three sections, one screen"
        />
        <SiteProse>
          <p>
            The <a href="/planning?tab=workflows">/planning Workflows tab</a>{" "}
            renders three independent surfaces fed by the same trace stream so
            you can read authored intent, emergent behavior, and unresolved
            noise side by side.
          </p>
        </SiteProse>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SiteTextCard
            title="Authored"
            body={
              <p className="text-xs text-muted-foreground">
                One mermaid diagram per file under{" "}
                <code>.planning/workflows/</code>. Score = the conformance
                formula above. Decision diamonds and nesting are intentional —
                this is where you read intent.
              </p>
            }
          />
          <SiteTextCard
            title="Emergent"
            body={
              <p className="text-xs text-muted-foreground">
                Compact React-Flow grid (decision gad-175 + gad-177) of skill
                chains the synthesizer found across the trace. No synthetic
                mermaid here; emergent flows weren't designed, so a hand-drawn
                language would lie about their shape.
              </p>
            }
          />
          <SiteTextCard
            title="Noise"
            body={
              <p className="text-xs text-muted-foreground">
                Tool-level patterns that survived v2 filtering. Each one is a
                question: "should this be a skill?" Promotion path:{" "}
                <code>gad workflow promote</code>.
              </p>
            }
          />
        </div>
      </SiteSection>

      <SiteSection cid="WorkflowsMethodologyRefs">
        <SiteSectionHeading kicker="References" title="Decisions and source files" />
        <ul
          id="refs"
          className="mt-4 space-y-2 text-sm text-muted-foreground"
        >
          <li>
            <strong className="text-foreground/85">gad-173</strong> — Workflow
            validator = expected/actual diff. Closes nesting, validation, and
            self-report questions.
          </li>
          <li>
            <strong className="text-foreground/85">gad-175</strong> — Trace
            events are scoped (<code>gad-framework</code> /{" "}
            <code>eval-agent</code> / <code>brood-project</code>); the
            synthesizer filters by scope.
          </li>
          <li>
            <strong className="text-foreground/85">gad-177</strong> — Emergent
            workflows have no authored Mermaid; they render React-Flow only.
          </li>
          <li>
            <strong className="text-foreground/85">gad-178</strong> — Skills
            determine workflows; tool-level mining is a v1 shortcut.
          </li>
          <li className="pt-2">
            <strong className="text-foreground/85">Source:</strong>{" "}
            <a
              className="text-accent hover:underline"
              href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/workflows/README.md"
              rel="noreferrer"
              target="_blank"
            >
              .planning/workflows/README.md
            </a>{" "}
            · <code>.planning/.trace-events.jsonl</code> (live stream) · the
            v2 detector lives in <code>lib/workflow-tag-parser.cjs</code> +{" "}
            <code>scripts/build-site-data.mjs</code>.
          </li>
        </ul>
      </SiteSection>
    </MarketingShell>
  );
}
