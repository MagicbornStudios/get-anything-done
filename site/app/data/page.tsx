import Link from "next/link";
import { Database, Github, Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import {
  EVAL_RUNS,
  ALL_DECISIONS,
  ALL_TASKS,
  ALL_PHASES,
  GLOSSARY,
  OPEN_QUESTIONS,
  BUGS,
} from "@/lib/eval-data";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Data provenance — GAD",
  description:
    "Every chart and number on this site, with its source field, derivation formula, and trust level. Inline + indexed transparency.",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

interface DataSource {
  id: string;
  surface: string;
  number: string;
  source: string;
  formula?: string;
  trust: "deterministic" | "self-report" | "human" | "authored";
  page: string;
  notes?: string;
}

const SOURCES: DataSource[] = [
  // Hero stats
  {
    id: "playable-count",
    surface: "Hero",
    number: "Playable runs",
    source: "PLAYABLE_INDEX (lib/eval-data.generated.ts)",
    formula: "Object.keys(PLAYABLE_INDEX).length",
    trust: "deterministic",
    page: "/",
    notes: "Set at prebuild from auditPlayable() — counts directories under apps/portfolio/public/evals/<project>/<version>/.",
  },
  {
    id: "runs-scored",
    surface: "Hero",
    number: "Runs scored",
    source: "EVAL_RUNS",
    formula: "EVAL_RUNS.filter(r => r.scores.composite != null).length",
    trust: "deterministic",
    page: "/",
  },
  {
    id: "decisions-logged",
    surface: "Hero",
    number: "Decisions logged",
    source: "ALL_DECISIONS",
    formula: "ALL_DECISIONS.length (parseAllDecisions() over .planning/DECISIONS.xml)",
    trust: "deterministic",
    page: "/",
  },
  // Per-run cards
  {
    id: "composite",
    surface: "Per-run card",
    number: "Composite score",
    source: "TRACE.json scores.composite",
    formula: "Σ_dimensions (weight * dimension_score), capped by gate failures",
    trust: "self-report",
    page: "/runs/[project]/[version]",
    notes: "Composite is currently agent-self-reported in TRACE.json. Programmatic alternative tracked under GAPS.md G1 (deferred until UI stabilizes per gad-99).",
  },
  {
    id: "human-review",
    surface: "Per-run card",
    number: "Human review aggregate",
    source: "TRACE.json human_review (rubric form)",
    formula: "Σ_dimensions (weight * score) per project's human_review_rubric",
    trust: "human",
    page: "/runs/[project]/[version]",
    notes: "Submitted via `gad eval review --rubric '{...}'`. Per-dimension scoring per gad-61 / decision gad-70.",
  },
  // Pressure
  {
    id: "pressure-by-round",
    surface: "Roadmap",
    number: "Pressure rating per round",
    source: "PRESSURE_BY_ROUND constant in app/roadmap/page.tsx",
    formula: "f(requirement complexity, ambiguity, constraint density, iteration budget, failure cost) — currently authored",
    trust: "authored",
    page: "/roadmap",
    notes: "Will become programmatic when the pressure-score-formula open question resolves. See gad-75.",
  },
  // CSH
  {
    id: "skill-inheritance-effectiveness",
    surface: "Emergent",
    number: "Skill inheritance effectiveness",
    source: "TRACE.json human_review.dimensions.skill_inheritance_effectiveness",
    formula: "Human-rated 0.0–1.0 on whether the run productively inherited + evolved + authored skills",
    trust: "human",
    page: "/emergent",
    notes: "The compound-skills hypothesis test signal. Hygiene component (file-mutation events + CHANGELOG validity) is queued as GAPS G11 — automatable.",
  },
  // Tool use mix
  {
    id: "tool-use-mix",
    surface: "Per-run page",
    number: "Tool-use mix",
    source: "TRACE.json derived.tool_use_mix",
    formula: "Counts of tool_use events per tool name from the trace stream",
    trust: "deterministic",
    page: "/runs/[project]/[version]",
    notes: "Reference pattern for all new programmatic metrics — see GAPS.md G4.",
  },
  // Plan adherence
  {
    id: "plan-adherence-delta",
    surface: "Per-run page",
    number: "Plan-adherence delta",
    source: "TRACE.json derived.plan_adherence_delta",
    formula: "(tasks_committed - tasks_planned) / tasks_planned",
    trust: "deterministic",
    page: "/runs/[project]/[version]",
  },
  // Commits
  {
    id: "commit-rhythm",
    surface: "Per-run page",
    number: "Commit count + per-task discipline",
    source: "TRACE.json gitAnalysis (git log over the run's worktree)",
    formula: "Counts of commits, batch vs per-task, ratio of task-id-prefixed commits to total",
    trust: "deterministic",
    page: "/runs/[project]/[version]",
  },
  // Counts on planning pages
  {
    id: "decisions-count",
    surface: "/decisions",
    number: `Total decisions (${ALL_DECISIONS.length})`,
    source: "ALL_DECISIONS",
    formula: "parseAllDecisions() walks .planning/DECISIONS.xml",
    trust: "deterministic",
    page: "/decisions",
  },
  {
    id: "tasks-count",
    surface: "/tasks",
    number: `Total tasks (${ALL_TASKS.length})`,
    source: "ALL_TASKS",
    formula: "parseAllTasks() walks .planning/TASK-REGISTRY.xml",
    trust: "deterministic",
    page: "/tasks",
  },
  {
    id: "phases-count",
    surface: "/phases",
    number: `Total phases (${ALL_PHASES.length})`,
    source: "ALL_PHASES",
    formula: "parseAllPhases() walks .planning/ROADMAP.xml",
    trust: "deterministic",
    page: "/phases",
  },
  {
    id: "glossary-count",
    surface: "/glossary",
    number: `Glossary terms (${GLOSSARY.length})`,
    source: "GLOSSARY",
    formula: "data/glossary.json terms[]",
    trust: "authored",
    page: "/glossary",
  },
  {
    id: "questions-count",
    surface: "/questions",
    number: `Open questions (${OPEN_QUESTIONS.length})`,
    source: "OPEN_QUESTIONS",
    formula: "data/open-questions.json questions[]",
    trust: "authored",
    page: "/questions",
  },
  {
    id: "bugs-count",
    surface: "/bugs",
    number: `Tracked bugs (${BUGS.length})`,
    source: "BUGS",
    formula: "data/bugs.json bugs[]",
    trust: "authored",
    page: "/bugs",
  },
];

const TRUST_TINT: Record<DataSource["trust"], "success" | "default" | "outline" | "danger"> = {
  deterministic: "success",
  "self-report": "danger",
  human: "default",
  authored: "outline",
};

const TRUST_DESCRIPTION: Record<DataSource["trust"], string> = {
  deterministic:
    "Computed by code from raw inputs at prebuild. Same inputs always produce the same number. Highest trust.",
  "self-report": "The agent put this number into TRACE.json itself. Lowest trust.",
  human: "A human submitted this via the rubric review CLI. Trustable but not scalable.",
  authored: "Hand-curated content (glossary, decisions, requirements). Trust is editorial.",
};

function groupBySurface(sources: DataSource[]) {
  const groups = new Map<string, DataSource[]>();
  for (const s of sources) {
    const arr = groups.get(s.surface) ?? [];
    arr.push(s);
    groups.set(s.surface, arr);
  }
  return [...groups.entries()];
}

export default function DataPage() {
  const grouped = groupBySurface(SOURCES);
  const totals = SOURCES.reduce<Record<string, number>>((acc, s) => {
    acc[s.trust] = (acc[s.trust] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Data provenance</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Every number, with a receipt.{" "}
            <span className="gradient-text">Show me where this came from.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Research credibility lives or dies on whether you can trace a
            number back to its inputs. This page indexes every chart and stat
            on the site with: where the number comes from, how it&apos;s
            derived, and whether the source is{" "}
            <strong className="text-emerald-300">deterministic</strong>{" "}
            (computed at prebuild),{" "}
            <strong className="text-rose-300">self-reported</strong>{" "}
            (the agent put it in TRACE.json),{" "}
            <strong>human-rated</strong> (submitted via the rubric CLI), or{" "}
            <strong className="text-muted-foreground">authored</strong>{" "}
            (hand-curated content).
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Per <Ref id="gad-69" /> (programmatic-eval priority), every new
            metric must answer &quot;can this be collected programmatically?&quot;
            before &quot;how do we score it?&quot;. The push is to move
            self-report sources toward deterministic ones &mdash; the gaps
            are tracked in{" "}
            <a
              href={`${REPO}/blob/main/.planning/docs/GAPS.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              .planning/docs/GAPS.md
            </a>
            .
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <TrustCount
              label="Deterministic"
              count={totals.deterministic ?? 0}
              tint="success"
            />
            <TrustCount
              label="Human-rated"
              count={totals.human ?? 0}
              tint="default"
            />
            <TrustCount
              label="Authored"
              count={totals.authored ?? 0}
              tint="outline"
            />
            <TrustCount
              label="Self-report"
              count={totals["self-report"] ?? 0}
              tint="danger"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">Trust levels explained</p>
          <div className="grid gap-3 md:grid-cols-2">
            {(["deterministic", "human", "authored", "self-report"] as const).map((t) => (
              <Card key={t}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={TRUST_TINT[t]}>{t}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-xs leading-5 text-muted-foreground">
                  {TRUST_DESCRIPTION[t]}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {grouped.map(([surface, sources]) => (
        <section
          key={surface}
          id={`surface-${surface.toLowerCase().replace(/\s+/g, "-")}`}
          className="border-b border-border/60 last:bg-background"
        >
          <div className="section-shell">
            <div className="mb-6 flex items-center gap-3">
              <Database size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0">{surface}</p>
              <Badge variant="outline">{sources.length}</Badge>
            </div>
            <div className="space-y-3">
              {sources.map((s) => (
                <SourceCard key={s.id} source={s} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <Footer />
    </main>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  return (
    <Card id={source.id}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{source.number}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={TRUST_TINT[source.trust]}>{source.trust}</Badge>
            <Link
              href={source.page}
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
            >
              {source.page}
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-start gap-2 text-xs">
          <Code2 size={11} className="mt-1 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source
            </p>
            <code className="text-xs text-foreground/90">{source.source}</code>
          </div>
        </div>
        {source.formula && (
          <div className="mb-2 ml-5 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Formula
            </p>
            <code className="text-xs text-foreground/90">{source.formula}</code>
          </div>
        )}
        {source.notes && (
          <p className="ml-5 mt-2 border-l-2 border-accent/40 pl-3 text-xs leading-5 text-muted-foreground">
            {source.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TrustCount({
  label,
  count,
  tint,
}: {
  label: string;
  count: number;
  tint: "success" | "default" | "outline" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <Badge variant={tint}>{label}</Badge>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{count}</p>
    </div>
  );
}
