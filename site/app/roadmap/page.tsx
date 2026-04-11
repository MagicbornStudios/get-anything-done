import Link from "next/link";
import { Rocket, Flame, ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { ROUND_SUMMARIES, EVAL_RUNS, TASK_PRESSURE, type EvalRunRecord } from "@/lib/eval-data";
import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";

export const metadata = {
  title: "Roadmap — GAD",
  description:
    "Round-by-round timeline of every eval round, the requirements version it targeted, outcomes, honest shortcomings, and mitigations. Pressure progression across rounds.",
};

/**
 * Per-round task_pressure. Values for rounds with a current template
 * (v4/v5) are COMPUTED programmatically from REQUIREMENTS.xml structure per
 * decision gad-79. Values for historical rounds (v1-v3) without a current
 * template remain as author-rated estimates until their XMLs are
 * reconstructed. Annotations come from the round context.
 */
function tierLabel(score: number): string {
  if (score >= 0.85) return "High";
  if (score >= 0.65) return "Medium-High";
  if (score >= 0.45) return "Medium";
  if (score >= 0.25) return "Low-Medium";
  return "Low";
}

const PRESSURE_ANNOTATIONS: Record<string, { note: string; source: "computed" | "authored" }> = {
  "Round 1": {
    source: "authored",
    note: "12 systems-focused criteria, no gates. Agents could ship invisible backend and still score 1.0 on requirement_coverage. v1 template not preserved — this is an estimated value until the v1 XML is reconstructed.",
  },
  "Round 2": {
    source: "authored",
    note: "Added 2 gate criteria and UI-first mandate. Vertical-slice priority introduced. v2 template not preserved — estimated.",
  },
  "Round 3": {
    source: "authored",
    note: "3 explicit gates (game-loop, spell-crafting, UI quality). Rubric weights shifted toward human review. v3 template not preserved — estimated.",
  },
  "Round 4": {
    source: "computed",
    note: "4 gates including pressure-mechanics gate itself. Authored-only, ingenuity requirement, forge must tie to encounter design. v4 is the first round with a preserved current template — pressure is COMPUTED from REQUIREMENTS.xml structure (gad-79).",
  },
  "Round 5": {
    source: "computed",
    note: "v5 adds 21 requirements on top of v4 base via the <addendum> block: rule-based combat, entity-trait action policies, save checkpoints, spells-as-ingredients, visual map, event-driven rendering. Pressure is COMPUTED from the v5 REQUIREMENTS.xml including the addendum (gad-79).",
  },
};

// Manual fallback values for pre-v4 rounds without a preserved current template.
const AUTHORED_PRESSURE: Record<string, number> = {
  "Round 1": 0.15,
  "Round 2": 0.35,
  "Round 3": 0.55,
};

// Map round number → requirements version that round targeted.
const ROUND_TO_VERSION: Record<string, string> = {
  "Round 1": "v1",
  "Round 2": "v2",
  "Round 3": "v3",
  "Round 4": "v5", // v4 template now carries the v5 addendum — single source of truth
  "Round 5": "v5",
};

/**
 * Build the hypothesis-tracks chart data by grouping EVAL_RUNS per round and
 * per workflow, then extracting the aggregate human review score per
 * (round × workflow) cell. Missing cells become null (chart renders gap).
 */
function buildTrackData(): HypothesisTrackPoint[] {
  const roundForVersion: Record<string, string> = {
    v1: "Round 1", v2: "Round 1", v3: "Round 1", v4: "Round 1", v5: "Round 1",
    v6: "Round 2", v7: "Round 2",
    v8: "Round 3",
    v9: "Round 4", v10: "Round 4",
  };
  const bareRoundForVersion: Record<string, string> = {
    v1: "Round 2", v2: "Round 2",
    v3: "Round 3",
    v4: "Round 4", v5: "Round 4",
  };
  const emergentRoundForVersion: Record<string, string> = {
    v1: "Round 2",
    v2: "Round 3",
    v3: "Round 4", v4: "Round 4",
  };

  const rounds = ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"];
  const points: HypothesisTrackPoint[] = rounds.map((round) => ({
    round,
    freedom: null,
    csh: null,
    gad: null,
    contentDriven: null,
    codex: null,
  }));
  const byRound = new Map(points.map((p) => [p.round, p]));

  // Pick the best-scoring run of each workflow per round. "Best" = highest
  // aggregate_score from the normalized rubric, falling back to legacy score.
  function scoreOf(r: EvalRunRecord): number | null {
    const agg = r.humanReviewNormalized?.aggregate_score;
    if (typeof agg === "number") return agg;
    const legacy = r.humanReview?.score;
    if (typeof legacy === "number") return legacy;
    return null;
  }

  for (const run of EVAL_RUNS) {
    let round: string | undefined;
    let series: "gad" | "freedom" | "csh" | undefined;

    if (run.project === "escape-the-dungeon") {
      round = roundForVersion[run.version];
      series = "gad";
    } else if (run.project === "escape-the-dungeon-bare") {
      round = bareRoundForVersion[run.version];
      series = "freedom";
    } else if (run.project === "escape-the-dungeon-emergent") {
      round = emergentRoundForVersion[run.version];
      series = "csh";
    }

    if (!round || !series) continue;
    const point = byRound.get(round);
    if (!point) continue;

    const s = scoreOf(run);
    if (s == null) continue;

    // Keep the best score per cell
    const existing = point[series];
    if (existing == null || s > existing) {
      point[series] = s;
    }
  }

  return points;
}

function pressureForRound(round: string): { value: number; tier: string; note: string; source: "computed" | "authored" } {
  const annotation = PRESSURE_ANNOTATIONS[round];
  const version = ROUND_TO_VERSION[round];
  const computed = version ? TASK_PRESSURE[version] : undefined;

  if (computed && annotation?.source === "computed") {
    return {
      value: computed.score,
      tier: tierLabel(computed.score),
      note: annotation.note,
      source: "computed",
    };
  }

  const authored = AUTHORED_PRESSURE[round] ?? 0;
  return {
    value: authored,
    tier: tierLabel(authored),
    note: annotation?.note ?? "",
    source: "authored",
  };
}

const FUTURE_ROUNDS = [
  {
    round: "Round 5",
    title: "Greenfield, three-condition, requirements v5",
    body: "**Status:** planned — blocked on HTTP 529 investigation before GAD v11 retry.\n\n**Conditions:** GAD v11, Bare v6, Emergent v5. Serial execution per gad-67.\n\n**What we expect to learn:** (a) does the compound-skills hypothesis hold when requirements expand by 21 items simultaneously? (b) can the GAD workflow finally finish a round against pressure-tier High without api interruption? (c) does Bare's monotonic improvement continue, or does the v5 complexity leap break the pattern?\n\n**Hypothesis tested:** CSH primary. Freedom hypothesis as secondary measurement.",
  },
  {
    round: "Round 6",
    title: "Content-pack injection experiment",
    body: "**Status:** queued — depends on gad-66 content-pack extraction CLI.\n\n**New eval track:** escape-the-dungeon-inherited-content. Runs a new build on top of a preserved content pack (spells, runes, items, NPCs) extracted from the best round-5 runs.\n\n**Hypothesis tested:** content-driven hypothesis. Distinct from freedom and CSH — we do NOT compare content-pack runs to greenfield runs on the same rubric.",
  },
  {
    round: "Round 7",
    title: "Codex vs Claude Code comparison",
    body: "**Status:** queued — depends on gad.json `runner` field extension.\n\n**Setup:** identical requirements (likely v4 for cleanest comparison, re-run as a hypothesis revisit per gad-72), identical workflows, different agent runtime. One worktree per runner, serial execution.\n\n**Hypothesis tested:** runtime-effect hypothesis. New line of data, not a new requirements version.",
  },
];

export default function RoadmapPage() {
  const roundedRuns = EVAL_RUNS.length;
  const trackData = buildTrackData();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Roadmap</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Round by round,{" "}
            <span className="gradient-text">pressure climbs.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Every round is defined by a{" "}
            <Link href="/requirements" className="text-accent underline decoration-dotted">
              requirements version
            </Link>
            . Requirements expand monotonically — v1 was 12 flat criteria, v5 is{" "}
            {"~"}40 criteria with cross-cutting pressure mechanics. This page shows what we
            asked, what the agents shipped, the honest shortcomings we documented, and how
            each round set up the next. Pressure rating per round is self-assessed (gad-75)
            until the pressure-score formula is programmatic.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Framework: decision{" "}
            <Link href="/decisions#gad-72" className="text-accent underline decoration-dotted">
              gad-72
            </Link>{" "}
            (rounds are requirements-versioned, progressively more complex, earlier rounds
            can be revisited with new hypotheses).
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {ROUND_SUMMARIES.length}
              </span>{" "}
              rounds run
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {FUTURE_ROUNDS.length}
              </span>{" "}
              rounds planned
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {roundedRuns}
              </span>{" "}
              runs preserved
            </div>
          </div>
        </div>
      </section>

      {/* Hypothesis tracks chart — task 22-24 */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <p className="section-kicker !mb-0">Hypothesis tracks across rounds</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            One line per hypothesis track. Freedom = bare condition.
            CSH = emergent (compound-skills). GAD = full-framework condition.
            Content-driven and Codex runtime are planned tracks with no scored
            runs yet — shown as dashed lines to make the research plan visible.
            Round 5 is queued pending the HTTP 529 investigation.
          </p>
          <HypothesisTracksChart data={trackData} />
        </div>
      </section>

      {/* Pressure progression strip */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <Flame size={18} className="text-amber-400" aria-hidden />
            <p className="section-kicker !mb-0">Pressure progression</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Self-assessed pressure per round on a 0.0 – 1.0 scale aggregating requirement
            complexity, ambiguity, constraint density, iteration budget, and failure cost
            (see decision{" "}
            <Link href="/decisions#gad-75" className="text-accent underline decoration-dotted">
              gad-75
            </Link>
            ).
          </p>
          <div className="space-y-3">
            {["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"].map((round) => {
              const p = pressureForRound(round);
              if (!p) return null;
              const pct = Math.round(p.value * 100);
              return (
                <div
                  key={round}
                  className="grid grid-cols-[80px_1fr_60px_auto] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[100px_1fr_80px_auto]"
                >
                  <div>
                    <div className="font-mono text-xs text-foreground">{round}</div>
                    <div className="text-[10px] text-muted-foreground">{p.tier}</div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 via-amber-400/70 to-rose-500/80"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums text-foreground">
                    {p.value.toFixed(2)}
                  </div>
                  <Badge
                    variant={p.source === "computed" ? "success" : "outline"}
                    className="text-[9px]"
                  >
                    {p.source}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            <strong className="text-foreground">Data provenance:</strong> rounds 4 and 5
            show <strong className="text-emerald-300">computed</strong> values — derived
            programmatically from the REQUIREMENTS.xml structure via{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">computeTaskPressure()</code>{" "}
            in{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">build-site-data.mjs</code>
            . Formula (decision{" "}
            <Link href="/decisions#gad-79" className="text-accent underline decoration-dotted">
              gad-79
            </Link>
            ):{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">
              raw = R + 2*G + C; score = log2(raw+1) / log2(65)
            </code>
            {" "}where R = requirement elements, G = gates, C = amends cross-cuts. Rounds
            1-3 show <strong className="text-muted-foreground">authored</strong> values
            because their REQUIREMENTS.xml templates were not preserved — those will
            become computed once the historical XMLs are reconstructed.
          </p>
        </div>
      </section>

      {/* Completed rounds */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-8 flex items-center gap-3">
            <Rocket size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Completed rounds</p>
          </div>
          <div className="space-y-6">
            {ROUND_SUMMARIES.map((r) => {
              const p = pressureForRound(r.round);
              return (
                <RoundCard
                  key={r.round}
                  round={r.round}
                  title={r.title}
                  body={r.body}
                  pressure={p}
                  status="completed"
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Future rounds */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-8 flex items-center gap-3">
            <ArrowRight size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Planned rounds</p>
          </div>
          <div className="space-y-6">
            {FUTURE_ROUNDS.map((r) => {
              const p = pressureForRound(r.round);
              return (
                <RoundCard
                  key={r.round}
                  round={r.round}
                  title={r.title}
                  body={r.body}
                  pressure={p}
                  status="planned"
                />
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function RoundCard({
  round,
  title,
  body,
  pressure,
  status,
}: {
  round: string;
  title: string;
  body: string;
  pressure?: { value: number; tier: string; note: string; source: "computed" | "authored" };
  status: "completed" | "planned";
}) {
  return (
    <Card id={round.toLowerCase().replace(" ", "-")} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "completed" ? "success" : "outline"}>{round}</Badge>
          {pressure && (
            <Badge variant="outline" className="inline-flex items-center gap-1.5">
              <Flame size={10} aria-hidden />
              pressure {pressure.value.toFixed(2)} ({pressure.tier})
            </Badge>
          )}
          <Badge variant={status === "completed" ? "outline" : "default"}>{status}</Badge>
        </div>
        <CardTitle className="mt-2 text-lg leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-muted-foreground">
          {body}
        </pre>
        {pressure && (
          <p className="mt-4 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <Flame size={9} className="mr-1 inline text-amber-400" aria-hidden />
            <strong className="text-foreground">Why this pressure rating:</strong>{" "}
            {pressure.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
