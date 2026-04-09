import Link from "next/link";
import { Rocket, Flame, ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { ROUND_SUMMARIES, EVAL_RUNS } from "@/lib/eval-data";

export const metadata = {
  title: "Roadmap — GAD",
  description:
    "Round-by-round timeline of every eval round, the requirements version it targeted, outcomes, honest shortcomings, and mitigations. Pressure progression across rounds.",
};

/**
 * Per-round pressure rating (self-rated per gad-75). Becomes programmatic when
 * the pressure-score-formula open question resolves. Until then these are
 * authored estimates against the five pressure dimensions.
 */
const PRESSURE_BY_ROUND: Record<string, { value: number; tier: string; note: string }> = {
  "Round 1": {
    value: 0.15,
    tier: "Low",
    note: "12 systems-focused criteria, no gates. Agents could ship invisible backend and still score 1.0 on requirement_coverage.",
  },
  "Round 2": {
    value: 0.35,
    tier: "Low-Medium",
    note: "Added 2 gate criteria and UI-first mandate. Vertical-slice priority introduced.",
  },
  "Round 3": {
    value: 0.55,
    tier: "Medium",
    note: "3 explicit gates (game-loop, spell-crafting, UI quality). Rubric weights shifted toward human review.",
  },
  "Round 4": {
    value: 0.80,
    tier: "High",
    note: "4 gates including pressure-mechanics gate itself. Authored-only, ingenuity requirement, forge must tie to encounter design. 'Starter abilities must NOT be sufficient.'",
  },
  "Round 5": {
    value: 0.92,
    tier: "High",
    note: "v5 adds 21 requirements on top of v4 base: rule-based combat, entity-trait action policies, save checkpoints, spells-as-ingredients, visual map, event-driven rendering. Round not yet executed (blocked on HTTP 529 investigation).",
  },
};

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
              const p = PRESSURE_BY_ROUND[round];
              if (!p) return null;
              const pct = Math.round(p.value * 100);
              return (
                <div
                  key={round}
                  className="grid grid-cols-[80px_1fr_60px] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[100px_1fr_80px]"
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
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            <strong className="text-foreground">Data provenance:</strong> values are
            authored in{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">app/roadmap/page.tsx</code>{" "}
            as <code className="rounded bg-background/60 px-1 py-0.5">PRESSURE_BY_ROUND</code>.
            Will become programmatic once the pressure-score-formula open question
            resolves.
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
              const p = PRESSURE_BY_ROUND[r.round];
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
              const p = PRESSURE_BY_ROUND[r.round];
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
  pressure?: { value: number; tier: string; note: string };
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
