import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";
import { EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

/**
 * Landing-page section rendering the interactive hypothesis-tracks chart.
 * Duplicates the buildTrackData helper from /roadmap intentionally — the
 * landing page and /roadmap both need the chart and neither should pull
 * logic from the other. If the mapping changes, update both.
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

    const existing = point[series];
    if (existing == null || s > existing) {
      point[series] = s;
    }
  }

  return points;
}

export default function HypothesisTracksSection() {
  const data = buildTrackData();

  return (
    <section id="tracks" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Hypothesis tracks</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Every hypothesis,{" "}
          <span className="gradient-text">one line per round.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Each line is a research track we are testing. Freedom = bare
          workflow. CSH = emergent workflow. GAD framework = full framework.
          Planned tracks (content-driven, codex runtime) show as dashed ghost
          lines so you can see the research plan even where no data exists
          yet. Read <Link href="/skeptic" className="text-accent underline decoration-dotted">/skeptic</Link>{" "}
          before trusting any individual point — sample sizes are small.
        </p>

        <div className="mt-10">
          <HypothesisTracksChart data={data} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/hypotheses"
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-4 py-2 font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            All hypotheses
            <ArrowRight size={13} aria-hidden />
          </Link>
          <Link
            href="/emergent"
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            CSH evidence
            <ArrowRight size={13} aria-hidden />
          </Link>
          <Link
            href="/freedom"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            Freedom evidence
            <ArrowRight size={13} aria-hidden />
          </Link>
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-4 py-2 font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            Full roadmap
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
