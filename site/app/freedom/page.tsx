import Link from "next/link";
import { TrendingUp, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import {
  EVAL_RUNS,
  PLAYABLE_INDEX,
  type EvalRunRecord,
} from "@/lib/eval-data";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Freedom Hypothesis — GAD",
  description:
    "Evidence rollup for the freedom hypothesis: for creative implementation tasks, less prescribed framework structure may lead to better output. Tracked via the bare eval workflow.",
};

const PROJECT_ID = "escape-the-dungeon-bare";

function bareRuns(): EvalRunRecord[] {
  return EVAL_RUNS.filter((r) => r.project === PROJECT_ID).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}

function runKey(r: EvalRunRecord): string {
  return `${r.project}/${r.version}`;
}

export default function FreedomHypothesisPage() {
  const runs = bareRuns();
  const playable = runs.filter((r) => PLAYABLE_INDEX[runKey(r)]);
  const scored = runs.filter(
    (r) =>
      (r.humanReviewNormalized &&
        !r.humanReviewNormalized.is_empty &&
        r.humanReviewNormalized.aggregate_score != null) ||
      typeof r.humanReview?.score === "number"
  );

  function score(r: EvalRunRecord): number {
    return (
      r.humanReviewNormalized?.aggregate_score ??
      r.humanReview?.score ??
      0
    );
  }

  const latest = runs[runs.length - 1];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-2">
            <Badge
              variant="default"
              className="inline-flex items-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            >
              Freedom hypothesis
            </Badge>
          </div>
          <p className="section-kicker">Freedom</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Less framework,{" "}
            <span className="gradient-text">better output?</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            The freedom hypothesis (<Ref id="gad-36" />) emerged from round 3: the{" "}
            <Link
              href="/glossary#bare-workflow"
              className="cursor-help underline decoration-dotted decoration-accent/60"
              title="Bare workflow"
            >
              bare condition
            </Link>{" "}
            — no framework, no inherited skills, just AGENTS.md + requirements —
            kept outscoring the full GAD condition on human review. Bare has
            improved monotonically across rounds. GAD never exceeded 0.30. This
            page rolls up the evidence, the caveats, and a hard link to the{" "}
            <Link
              href="/skeptic#freedom"
              className="text-rose-300 underline decoration-dotted"
            >
              skeptic critique
            </Link>{" "}
            — read that too before trusting the pattern.
          </p>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Stat label="Bare runs" value={runs.length.toString()} />
            <Stat label="Playable" value={playable.length.toString()} />
            <Stat label="Scored" value={scored.length.toString()} />
            <Stat
              label="Latest score"
              value={latest ? score(latest).toFixed(3) : "—"}
            />
          </div>
        </div>
      </section>

      {/* Score progression */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <TrendingUp size={18} className="text-emerald-400" aria-hidden />
            <p className="section-kicker !mb-0">Human review across rounds</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Each row is one bare run. If the freedom hypothesis is real, the
            line goes up-and-to-the-right. So far it does — but{" "}
            <strong className="text-foreground">n=5 is not a curve</strong>,
            and each run targeted a harder requirements version, so the
            improvement may be the requirements getting clearer rather than
            freedom itself paying off.
          </p>
          <div className="space-y-3">
            {runs.map((r) => {
              const s = score(r);
              const pct = Math.round(s * 100);
              return (
                <div
                  key={runKey(r)}
                  className="grid grid-cols-[60px_1fr_80px] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[80px_1fr_100px]"
                >
                  <div>
                    <div className="font-mono text-xs text-foreground">{r.version}</div>
                    <div className="text-[10px] text-muted-foreground">{r.date}</div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full bg-emerald-500/70"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums text-foreground">
                    {s.toFixed(3)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            <strong className="text-foreground">Data provenance:</strong> scores
            from{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">
              EVAL_RUNS[].humanReviewNormalized.aggregate_score
            </code>{" "}
            or legacy{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">
              humanReview.score
            </code>{" "}
            for runs predating the rubric.
          </p>
        </div>
      </section>

      {/* What the bare workflow is */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">What &quot;bare&quot; means</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">No framework</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Bare runs get AGENTS.md + REQUIREMENTS.xml. No .planning/ XML,
                no plan-execute-verify loop, no skill library, no subagents.
                The agent creates its own structure.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Own workflow</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                The agent authors whatever planning artifacts it finds useful
                under <code className="rounded bg-card/60 px-1 py-0.5 text-xs">game/.planning/</code>.
                Per decision gad-39, all workflow artifacts live there
                regardless of framework choice.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Contrast with emergent</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Bare starts cold every time. Emergent starts warm with
                inherited skills from prior runs. Both have no framework, but
                emergent tests compounding (CSH) while bare tests freedom.
                See{" "}
                <Link href="/standards" className="text-accent underline decoration-dotted">
                  /standards
                </Link>{" "}
                for the Anthropic skills guide + agentskills.io convention.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Caveats */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">Why this is a preliminary observation, not a finding</p>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm leading-6 text-muted-foreground">
            <p className="mb-3 font-semibold text-rose-200">
              Skeptic note (read{" "}
              <Link href="/skeptic#freedom" className="underline">
                /skeptic
              </Link>{" "}
              for the full critique):
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                <span>
                  N=5 is not a curve. The &quot;monotonic improvement&quot; is
                  exactly the kind of pattern random noise produces about 1 in
                  16 times by chance.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                <span>
                  Each bare version targets a harder requirements set. The
                  score improvement may be &quot;requirements got clearer&quot;
                  rather than &quot;bare is better than GAD.&quot;
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                <span>
                  Bare and GAD use different AGENTS.md prompts. The
                  &quot;framework&quot; variable is conflated with the
                  &quot;system prompt&quot; variable.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                <span>
                  GAD&apos;s design assumes multi-session work; greenfield
                  single-shot game implementation is not its strength case. We
                  may be testing GAD against the wrong benchmark.
                </span>
              </li>
            </ul>
          </div>
          <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
            What would falsify the freedom hypothesis: a round where bare
            produces a worse game than GAD on the same requirements with N ≥ 3
            replicates per condition, OR a different task domain where GAD
            beats bare. Neither has been run.
          </p>
        </div>
      </section>

      {/* Related pages */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Related</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/hypotheses"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              All hypotheses
              <ArrowRight size={12} aria-hidden />
            </Link>
            <Link
              href="/emergent"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              Compound-Skills Hypothesis (/emergent)
              <ArrowRight size={12} aria-hidden />
            </Link>
            <Link
              href="/content-driven"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              Content-driven (planned)
              <ArrowRight size={12} aria-hidden />
            </Link>
            <Link
              href="/projects/escape-the-dungeon-bare"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 hover:border-accent hover:text-accent"
            >
              escape-the-dungeon-bare project
              <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
