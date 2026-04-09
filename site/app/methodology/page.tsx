import Link from "next/link";
import { AlertTriangle, Calculator, CheckCircle2, FileJson, Gauge, Plug, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { EVAL_PROJECTS, EVAL_RUNS } from "@/lib/eval-data";

export const metadata = {
  title: "Methodology — how we score and trace GAD evals",
  description:
    "Every formula, every weight, every low-score cap, and the current trace schema explained end-to-end. Plus the known gaps in today's tracing.",
};

// Pick a concrete worked example — one gate-failed divergent run and one clean run.
function pickWorkedExamples() {
  const v8 = EVAL_RUNS.find((r) => r.project === "escape-the-dungeon" && r.version === "v8");
  const barev3 = EVAL_RUNS.find((r) => r.project === "escape-the-dungeon-bare" && r.version === "v3");
  return [v8, barev3].filter((x): x is NonNullable<typeof x> => x != null);
}

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Methodology</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Every formula, <span className="gradient-text">every weight,</span> every cap.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            This page is the appendix. Every number on the site — every bar, every composite, every
            "gate passed" badge — traces back to one of the formulas below. If you want to verify a
            run yourself, pull its{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> from
            GitHub and run the math from here.
          </p>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <Calculator size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Composite formula</p>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            The weighted sum
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            The composite score is a plain weighted sum of dimension scores. Every dimension is
            normalised to 0.0 – 1.0 before the multiply. The weights are project-specific and
            committed to{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/&lt;project&gt;/gad.json</code>.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-6 md:p-8">
            <p className="font-mono text-sm text-muted-foreground">composite =</p>
            <p className="mt-2 font-mono text-base leading-8 text-foreground">
              Σ<sub>dimensions</sub>
              <span className="mx-2">(</span>
              <span className="text-accent">score<sub>i</sub></span>
              <span className="mx-2">×</span>
              <span className="text-emerald-400">weight<sub>i</sub></span>
              <span className="mx-2">)</span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Weights sum to 1.0 across a project&apos;s dimensions. A run can max out at 1.0; the
              minimum is 0.0 (modulo the low-score cap below).
            </p>
          </div>

          <h3 className="mt-14 text-2xl font-semibold tracking-tight">
            Weights per eval project
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Different eval projects weight different dimensions. A tooling eval might care most
            about time efficiency; an implementation eval weighs human review at 30% to prevent
            process metrics from rescuing a broken artifact.
          </p>

          <div className="mt-6 space-y-5">
            {EVAL_PROJECTS.filter((p) => p.scoringWeights && p.workflow).map((p) => {
              const entries = Object.entries(p.scoringWeights ?? {}).sort(
                (a, b) => b[1] - a[1]
              );
              const total = entries.reduce((acc, [, w]) => acc + w, 0);
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-border/70 bg-card/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/30 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.evalMode} · {p.workflow}
                      </p>
                    </div>
                    <Badge variant="outline">
                      Σ weights = {total.toFixed(2)}
                    </Badge>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {entries.map(([dim, w], idx) => (
                        <tr
                          key={dim}
                          className={idx % 2 === 0 ? "bg-transparent" : "bg-background/20"}
                        >
                          <td className="px-5 py-2.5 font-mono text-[11px] text-foreground">
                            {dim}
                          </td>
                          <td className="px-5 py-2.5 tabular-nums text-accent">
                            {w.toFixed(2)}
                          </td>
                          <td className="px-5 py-2.5">
                            <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-border/60">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-accent/60 via-accent to-accent/80"
                                style={{ width: `${w * 100}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <Gauge size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Gate logic</p>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Gates override everything
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Starting with requirements v2, some criteria are marked{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">gate=&quot;true&quot;</code>
            . If any gate fails,{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">requirement_coverage</code>{" "}
            collapses to 0. This is how a run that &quot;ticks most boxes&quot; can still score
            near zero on the mechanical dimension — because one gate (e.g. G1 game loop softlocks)
            makes the rest meaningless.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            v1 runs (pre-gates) show a{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">pre-gate requirements</code>{" "}
            badge on their per-run pages instead of a pass/fail because the concept didn&apos;t
            exist yet. v3 introduced four explicit gates (game loop, spell crafting, UI quality);
            v4 added a fifth (pressure mechanics).
          </p>

          <h3 className="mt-12 text-xl font-semibold tracking-tight">Low-score caps (v3+)</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Layered on top of the weighted sum to prevent a broken run from reaching respectable
            territory on time-efficiency alone.
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">If weighted sum &lt;</th>
                  <th className="px-5 py-3 font-medium">Capped to</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-5 py-3 font-mono tabular-nums">0.20</td>
                  <td className="px-5 py-3 font-mono tabular-nums text-accent">0.40</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    Prevent near-zero runs from being falsely rescued by time efficiency bonuses.
                  </td>
                </tr>
                <tr className="bg-background/20">
                  <td className="px-5 py-3 font-mono tabular-nums">0.10</td>
                  <td className="px-5 py-3 font-mono tabular-nums text-accent">0.25</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    Reserved for runs that barely produced anything. Still appears in the results
                    set but clearly distinct from a mid-tier run.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <FileJson size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Trace schema</p>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            What&apos;s in TRACE.json (and what&apos;s missing)
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Every eval run writes a{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> sidecar
            next to the run artifacts. The current schema is v3. Fields below describe what it
            contains today.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TRACE_FIELDS.map((f) => (
              <Card key={f.name}>
                <CardHeader>
                  <CardDescription className="font-mono text-[11px]">{f.name}</CardDescription>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm leading-6 text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Known tracing gaps (decision gad-50)
              </p>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-foreground">
              <li>
                <strong>skill_accuracy is lossy.</strong> Some runs store the full{" "}
                <code className="rounded bg-card/60 px-1 py-0.5 text-xs">expected_triggers</code>{" "}
                array (v5 GAD runs do). Others store only the aggregate number. When only the
                aggregate is present, we can&apos;t tell which of the expected skills fired vs
                missed — see the &quot;tracing gap&quot; callout on the per-run page.
              </li>
              <li>
                <strong>Tool calls are not recorded.</strong> The current schema knows how many
                tools the agent used in aggregate (
                <code className="rounded bg-card/60 px-1 py-0.5 text-xs">token_usage.tool_uses</code>
                ) but not which tools, in what order, against which files.
              </li>
              <li>
                <strong>Subagent spawns are not recorded.</strong> If a command delegated work to{" "}
                <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad-planner</code> or{" "}
                <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad-phase-researcher</code>
                , that delegation is invisible in the trace.
              </li>
              <li>
                <strong>Framework version is not stamped.</strong> Two runs may have different
                scores because the framework changed between them, not because the agent got
                better or worse — and today there&apos;s no way to tell from the TRACE alone.
              </li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Phase 25 ships trace schema v4 to close all four gaps.{" "}
              <Link href="/planning" className="text-accent hover:underline">
                See the roadmap on /planning →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-2 flex items-center gap-2">
            <Plug size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Agent runtimes</p>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Which coding agents can produce trace v4 data
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Trace schema v4 (phase 25) needs to capture every tool call, skill invocation, and
            subagent spawn with inputs, outputs, and timestamps. The only reliable way to get
            that data is from inside the coding agent&apos;s runtime via hooks or callbacks.
            Agents without a hook runtime are <strong>explicitly unsupported</strong> for GAD
            evaluation &mdash; we&apos;re not going to screen-scrape stdout. Decision{" "}
            <Link
              href="/planning"
              className="text-accent hover:underline"
            >
              gad-53
            </Link>{" "}
            pins this.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Agent</th>
                  <th className="px-5 py-3 font-medium">Hook runtime</th>
                  <th className="px-5 py-3 font-medium">Trace v4 support</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {AGENT_RUNTIMES.map((row, idx) => (
                  <tr
                    key={row.agent}
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3 font-semibold text-foreground">{row.agent}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{row.hook}</td>
                    <td className="px-5 py-3">
                      {row.supported ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 size={14} aria-hidden />
                          supported
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                          <XCircle size={14} aria-hidden />
                          unsupported
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-2xl border border-border/70 bg-card/40 p-6">
            <p className="text-xs uppercase tracking-wider text-accent">
              Multi-agent support (decision gad-55)
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Agents beyond Claude Code are supported through{" "}
              <strong className="text-foreground">converters</strong>, not through per-agent trace
              code. A converter reads the target agent&apos;s native session format and emits GAD
              trace schema v4. The same{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">
                /runs/[project]/[version]
              </code>{" "}
              page renders it. Codex&apos;s{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">Running</code>/
              <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">Ran</code> stream
              format is parseable but requires streaming detection; Aider&apos;s Python callbacks
              are straightforward to hook into. Phase 25 ships the Claude Code converter first;
              Codex and Aider converters are future sub-phases if and when we want to run
              cross-agent comparisons.
            </p>
          </div>
        </div>
      </section>

      {worked.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Worked examples</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Two runs, end to end
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Two runs picked as walkthroughs — one process-vs-reality divergence, one
              highest-scoring bare run. Click through for the full per-run view with the formula
              breakdown.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {worked.map((run) => (
                <Card key={`${run.project}-${run.version}`}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {run.project} · {run.version}
                    </CardTitle>
                    <CardDescription>
                      composite {run.scores.composite?.toFixed(3) ?? "—"} · human{" "}
                      {run.humanReview?.score?.toFixed(2) ?? "—"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm leading-6 text-muted-foreground line-clamp-4">
                      {run.humanReview?.notes ?? run.requirementCoverage?.gate_notes ?? ""}
                    </p>
                    <Link
                      href={`/runs/${run.project}/${run.version}`}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                    >
                      Full breakdown →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}

const AGENT_RUNTIMES = [
  {
    agent: "Claude Code",
    hook: "PreToolUse / PostToolUse hooks via settings.json",
    supported: true,
    notes:
      "First-class support. Hooks run before and after every tool call; session.jsonl captures the full invocation stream. Phase 25 writes a hook handler that emits trace v4 events directly.",
  },
  {
    agent: "Aider",
    hook: "Python callbacks + chat history export",
    supported: true,
    notes:
      "Supported via converter. Python API exposes on_message / on_tool_call style callbacks; the existing chat history file is parseable for after-the-fact conversion. Future sub-phase.",
  },
  {
    agent: "Continue.dev",
    hook: "VS Code extension API (onToolCall, onChatUpdate)",
    supported: true,
    notes:
      "Supported via converter. Extension hosts expose tool-call events; we'd ship a small extension-side emitter that writes trace v4 to disk. Future sub-phase.",
  },
  {
    agent: "OpenAI Codex CLI",
    hook: "Structured stream output (Running/Ran prefixes)",
    supported: true,
    notes:
      "Supported via stream parser. Codex's terminal output format is line-delimited with recognisable prefixes (Running ..., • Ran ..., └ <output>). Lossier than hooks because reasoning text interleaves with tool calls and rate limits can truncate. Future sub-phase.",
  },
  {
    agent: "Cursor",
    hook: "Closed-source, no public hook API",
    supported: false,
    notes:
      "No way to trace from inside the editor. The only access is through the chat panel which has no tool-call visibility. Not supported until Cursor exposes a hook runtime.",
  },
  {
    agent: "Vanilla ChatGPT / Claude.ai web",
    hook: "None",
    supported: false,
    notes:
      "Web interfaces have no tool access and no extension points. Fundamentally the wrong shape of tool for the kind of work we're evaluating.",
  },
];

const TRACE_FIELDS = [
  {
    name: "timing",
    title: "Wall-clock duration",
    description: "Start/end timestamps plus duration in minutes. Used for time_efficiency.",
  },
  {
    name: "token_usage",
    title: "Tokens + tool uses",
    description: "Total tokens and total tool_uses. Does not record per-tool breakdown.",
  },
  {
    name: "git_analysis",
    title: "Commit discipline",
    description: "Total commits, how many had task ids, how many were batch commits. Drives per_task_discipline.",
  },
  {
    name: "planning_quality",
    title: "Planning doc production",
    description: "Phases planned, tasks planned vs completed, decisions captured, state updates.",
  },
  {
    name: "requirement_coverage",
    title: "Gate + criteria coverage",
    description: "Total criteria, fully/partially/not met counts, coverage_ratio, gate_failed, gate_notes.",
  },
  {
    name: "skill_accuracy",
    title: "Expected skill triggers",
    description: "Object form: array of expected_triggers with per-skill triggered bool. Aggregate form: bare number.",
  },
  {
    name: "workflow_emergence",
    title: "Bare/emergent workflow invention",
    description: "Booleans for whether the agent wrote task lists, state tracking, architecture docs, reusable skills. Used to score bare/emergent runs.",
  },
  {
    name: "scores",
    title: "Final normalised scores",
    description: "Every dimension as a number 0.0 – 1.0, plus composite. The single source of truth the site reads.",
  },
  {
    name: "human_review",
    title: "Reviewer verdict",
    description: "Score 0.0 – 1.0, notes, reviewer, timestamp. 30% of composite by design.",
  },
];
