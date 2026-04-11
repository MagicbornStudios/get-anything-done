import Link from "next/link";
import { Sparkles, TrendingUp, GitBranch, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { SkillLineageCard } from "@/components/emergent/SkillLineageCard";
import {
  EVAL_RUNS,
  PRODUCED_ARTIFACTS,
  PLAYABLE_INDEX,
  type EvalRunRecord,
} from "@/lib/eval-data";

export const metadata = {
  title: "Emergent — the compound-skills hypothesis",
  description:
    "Emergent is the eval workflow that inherits skills from previous runs, evolves them in place, and writes a CHANGELOG. This page rolls up every piece of evidence for the compound-skills hypothesis.",
};

const PROJECT_ID = "escape-the-dungeon-emergent";

function emergentRuns(): EvalRunRecord[] {
  return EVAL_RUNS.filter((r) => r.project === PROJECT_ID).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}

function runKey(r: EvalRunRecord): string {
  return `${r.project}/${r.version}`;
}

export default function EmergentPage() {
  const runs = emergentRuns();
  const playableRuns = runs.filter((r) => PLAYABLE_INDEX[runKey(r)]);
  const scoredRuns = runs.filter(
    (r) =>
      r.humanReviewNormalized &&
      !r.humanReviewNormalized.is_empty &&
      r.humanReviewNormalized.aggregate_score != null
  );

  const latestRun = runs[runs.length - 1];
  const latestScore = latestRun?.humanReviewNormalized?.aggregate_score ?? null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-2">
            <Badge
              variant="default"
              className="inline-flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300"
            >
              <Sparkles size={11} aria-hidden />
              Compound-skills hypothesis
            </Badge>
          </div>
          <p className="section-kicker">Emergent</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Does a skill library{" "}
            <span className="gradient-text">compound in value</span> across rounds?
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            The emergent workflow runs with no framework but inherits a skill library from
            previous runs. It&apos;s allowed to evolve skills in place, author new ones, and
            deprecate wrong ones via a CHANGELOG. If the{" "}
            <Link
              href="/glossary#compound-skills-hypothesis"
              className="cursor-help underline decoration-dotted decoration-accent/60"
              title="CSH"
            >
              compound-skills hypothesis
            </Link>{" "}
            is real, each emergent round should produce measurably better results than the
            last as the inherited library accumulates craft. This page is the evidence
            rollup.
          </p>

          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Anchor decisions:{" "}
            <Link href="/decisions#gad-65" className="text-accent underline decoration-dotted">
              gad-65
            </Link>{" "}
            (CSH pinned),{" "}
            <Link href="/decisions#gad-68" className="text-accent underline decoration-dotted">
              gad-68
            </Link>{" "}
            (emergent-evolution synthesis),{" "}
            <Link href="/decisions#gad-73" className="text-accent underline decoration-dotted">
              gad-73
            </Link>{" "}
            (fundamental skills triumvirate).
          </p>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Stat label="Emergent runs" value={runs.length.toString()} />
            <Stat label="Playable" value={playableRuns.length.toString()} />
            <Stat label="Scored" value={scoredRuns.length.toString()} />
            <Stat
              label="Latest score"
              value={latestScore != null ? latestScore.toFixed(3) : "—"}
            />
          </div>
        </div>
      </section>

      {/* Score progression */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <TrendingUp size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">CSH signal — human review across rounds</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            If skills are compounding, the line goes up-and-to-the-right across rounds.
            The sixth rubric dimension, <code className="rounded bg-background/60 px-1 py-0.5">skill_inheritance_effectiveness</code>,
            is the CSH-specific signal (weight 0.20).
          </p>
          <div className="space-y-3">
            {scoredRuns.map((r) => {
              const score = r.humanReviewNormalized?.aggregate_score ?? 0;
              const pct = Math.round(score * 100);
              const inheritanceScore =
                r.humanReviewNormalized?.dimensions?.skill_inheritance_effectiveness?.score ?? null;
              return (
                <div
                  key={runKey(r)}
                  className="grid grid-cols-[60px_1fr_60px_100px] items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 md:grid-cols-[80px_1fr_80px_140px]"
                >
                  <div>
                    <div className="font-mono text-xs text-foreground">{r.version}</div>
                    <div className="text-[10px] text-muted-foreground">{r.date}</div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full bg-amber-500/70"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums text-foreground">
                    {score.toFixed(3)}
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground">
                    {inheritanceScore != null ? (
                      <>
                        <Sparkles size={9} className="mr-1 inline text-amber-400" aria-hidden />
                        inherit {inheritanceScore.toFixed(2)}
                      </>
                    ) : (
                      <span className="opacity-60">no 6th dim</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {scoredRuns.length < 2 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Only {scoredRuns.length} scored run so far — not enough signal to claim the
              hypothesis is holding OR failing. Round 5 will be the first real trial against
              v5 requirements.
            </p>
          )}
          <p className="mt-4 text-[11px] text-muted-foreground">
            <strong className="text-foreground">Data provenance:</strong> scores read from{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">
              EVAL_RUNS[n].humanReviewNormalized.aggregate_score
            </code>
            , computed at prebuild from each run&apos;s rubric submission via{" "}
            <code className="rounded bg-background/60 px-1 py-0.5">gad eval review --rubric</code>.
          </p>
        </div>
      </section>

      {/* Skill lineage per run */}
      <section className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-3">
            <GitBranch size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Skill lineage per run</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Every run&apos;s skill footprint — what it inherited from the previous run,
            what new skills it authored, what it deprecated. A healthy CSH signal looks
            like: inherited count goes up, authored count stays positive, deprecated count
            is non-zero (the agent is self-correcting), and CHANGELOG dispositions are
            recorded.
          </p>
          <div className="space-y-4">
            {runs.map((r) => {
              const artifacts = PRODUCED_ARTIFACTS[runKey(r)];
              const skillFiles = artifacts?.skillFiles ?? [];
              return (
                <SkillLineageCard
                  key={runKey(r)}
                  runKey={runKey(r)}
                  version={r.version}
                  date={r.date}
                  playable={!!PLAYABLE_INDEX[runKey(r)]}
                  projectHref={`/#play`}
                  runHref={`/runs/${r.project}/${r.version}`}
                  skills={skillFiles.map((s) => ({
                    name: s.name,
                    bytes: s.bytes,
                    content: s.content ?? null,
                    file: s.file ?? null,
                  }))}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Framework explanation */}
      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">How emergent differs from bare and GAD</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bare</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                No framework, no inherited skills. Agent gets AGENTS.md + requirements and
                builds. Tests the freedom hypothesis directly.
              </CardContent>
            </Card>
            <Card className="border-l-4 border-amber-500/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-200">Emergent</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                No framework, but inherits skills from previous runs. Authors a CHANGELOG
                documenting disposition (kept / evolved / deprecated / replaced) of each
                inherited skill. Tests the CSH. See{" "}
                <Link href="/standards" className="text-accent underline decoration-dotted">
                  /standards
                </Link>{" "}
                for the SKILL.md format these skills follow.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">GAD</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Full framework: .planning/ XML, plan/execute/verify/commit loop, skill
                triggers. Tests whether process discipline pays off despite overhead.
              </CardContent>
            </Card>
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
