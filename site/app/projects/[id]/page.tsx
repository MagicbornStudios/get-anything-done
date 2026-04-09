import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileCode2, Gamepad2, Package, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import {
  EVAL_PROJECTS,
  EVAL_RUNS,
  EVAL_TEMPLATES,
  PLANNING_ZIPS,
  PRODUCED_ARTIFACTS,
  PROJECT_LABELS,
  WORKFLOW_LABELS,
  playableUrl,
  type EvalRunRecord,
  type Workflow,
} from "@/lib/eval-data";
import { SKILLS, SKILL_INHERITANCE } from "@/lib/catalog.generated";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export const dynamicParams = false;

export function generateStaticParams() {
  return EVAL_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.name} — GAD eval project`,
    description: project.description ?? "",
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function projectRuns(project: string): EvalRunRecord[] {
  return EVAL_RUNS.filter((r) => r.project === project).sort((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av - bv;
  });
}

function scopedSkillsFor(project: { workflow: string | null; id: string }): {
  kind: "framework" | "bootstrap-only" | "none";
  skills: typeof SKILLS;
  description: string;
} {
  if (project.workflow === "gad") {
    return {
      kind: "framework",
      skills: SKILLS,
      description:
        "GAD runs have the entire framework catalog available via slash commands. Every skill, every subagent, every command is reachable during the run.",
    };
  }
  // bare / emergent — only inherited skills
  const inherited = SKILLS.filter((s) =>
    (SKILL_INHERITANCE[s.id] ?? []).includes(project.id)
  );
  if (inherited.length === 0) {
    return {
      kind: "none",
      skills: [],
      description:
        "This project has no framework skills in its bootstrap set. The agent must author its own methodology from scratch.",
    };
  }
  return {
    kind: "bootstrap-only",
    skills: inherited,
    description:
      "This project inherits a minimal bootstrap skill set from the framework. The agent can apply these but must author its own methodology beyond them.",
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = EVAL_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const runs = projectRuns(project.id);
  const scope = scopedSkillsFor({ workflow: project.workflow, id: project.id });
  const template = EVAL_TEMPLATES.find((t) => t.project === project.id);
  const planning = PLANNING_ZIPS.find((p) => p.project === project.id);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <Link
            href="/#projects"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to projects
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">eval project</Badge>
            {project.workflow && (
              <Badge variant="outline">
                {WORKFLOW_LABELS[project.workflow as Workflow] ?? project.workflow}
              </Badge>
            )}
            {project.evalMode && <Badge variant="outline">{project.evalMode}</Badge>}
            {project.baseline && (
              <Badge variant="outline">
                baseline:{" "}
                {typeof project.baseline === "string"
                  ? project.baseline
                  : `${project.baseline.project ?? "?"}/${project.baseline.version ?? "?"}`}
              </Badge>
            )}
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            {PROJECT_LABELS[project.id] ?? project.name}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{project.id}</p>
          {project.description && (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-foreground">
              {project.description}
            </p>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            {planning && (
              <a
                href={planning.zipPath}
                download
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground hover:-translate-y-0.5 transition-transform"
              >
                <Download size={14} aria-hidden />
                planning.zip ({formatBytes(planning.bytes)})
              </a>
            )}
            {template && (
              <a
                href={template.zipPath}
                download
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
              >
                <Package size={14} aria-hidden />
                template.zip ({formatBytes(template.bytes)})
              </a>
            )}
            <a
              href={`${REPO}/tree/main/evals/${project.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
            >
              <ExternalLink size={12} aria-hidden />
              Source on GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">Catalog scope</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            What skills this project can use
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            {scope.description}
          </p>

          {scope.kind === "framework" && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/5 px-4 py-2 text-xs font-semibold text-sky-300">
              <Sparkles size={12} aria-hidden />
              Full framework catalog — {SKILLS.length} skills available
            </p>
          )}
          {scope.kind === "bootstrap-only" && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-4 py-2 text-xs font-semibold text-emerald-300">
              <Sparkles size={12} aria-hidden />
              Bootstrap set — {scope.skills.length} skill{scope.skills.length === 1 ? "" : "s"} inherited
            </p>
          )}

          {scope.kind !== "framework" && scope.skills.length > 0 && (
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {scope.skills.map((s) => (
                <Link
                  key={s.id}
                  href={`/skills/${s.id}`}
                  className="block rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-colors hover:border-emerald-500/60"
                >
                  <code className="font-mono text-sm text-accent">{s.name}</code>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {s.description}
                  </p>
                </Link>
              ))}
            </div>
          )}
          {scope.kind === "framework" && (
            <Link
              href="/gad"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-5 py-2.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
            >
              Browse the full GAD catalog →
            </Link>
          )}
        </div>
      </section>

      {runs.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Runs</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {runs.length} recorded run{runs.length === 1 ? "" : "s"}
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {runs.map((run) => {
                const composite = run.scores.composite ?? 0;
                const human = run.humanReview?.score ?? null;
                const playable = playableUrl(run);
                const produced = PRODUCED_ARTIFACTS[`${run.project}/${run.version}`];
                return (
                  <Card key={run.version} className="transition-colors hover:border-accent/60">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="default">{run.version}</Badge>
                        <Badge variant="outline">reqs {run.requirementsVersion}</Badge>
                      </div>
                      <CardTitle className="mt-2 text-lg">
                        composite {composite.toFixed(3)}
                      </CardTitle>
                      <CardDescription>
                        {human != null ? `human ${human.toFixed(2)}` : "human review pending"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {run.humanReview?.notes && (
                        <p className="line-clamp-3 text-xs text-muted-foreground">
                          {run.humanReview.notes}
                        </p>
                      )}
                      {produced && (
                        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          {produced.skillFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-emerald-300">
                              <FileCode2 size={9} aria-hidden />
                              {produced.skillFiles.length} skill{produced.skillFiles.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {produced.agentFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/5 px-2 py-0.5 text-sky-300">
                              {produced.agentFiles.length} agent{produced.agentFiles.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {produced.planningFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-amber-300">
                              {produced.planningFiles.length} planning
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                        <Link
                          href={`/runs/${run.project}/${run.version}`}
                          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-accent hover:underline"
                        >
                          full breakdown →
                        </Link>
                        {playable && (
                          <a
                            href={playable}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent hover:bg-accent/20"
                          >
                            <Gamepad2 size={10} aria-hidden />
                            play
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {project.workflow === "emergent" && runs.length > 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Skill inheritance lineage</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              The compound-skills hypothesis in action
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Decision <strong>gad-65</strong> pins the compound-skills hypothesis: as the
              emergent workflow iterates on the same project domain, the inherited skill
              library should grow more specialized and the resulting game should improve in
              quality and requirements-alignment per round. The craftsman metaphor — a
              blacksmith who writes one skill per hour becomes a master of the specific
              kind of blade they keep forging. Each row below is one emergent run; the
              columns show what the run inherited from the previous round, what it
              authored itself, and what it marked deprecated.
            </p>

            <div className="mt-10 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Run</th>
                    <th className="px-5 py-3 font-medium">Skills in planning/</th>
                    <th className="px-5 py-3 font-medium tabular-nums">Total</th>
                    <th className="px-5 py-3 font-medium">Net change</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, idx) => {
                    const runProduced = PRODUCED_ARTIFACTS[`${run.project}/${run.version}`];
                    const skillsInThisRun = runProduced?.skillFiles ?? [];
                    const prevRun = runs[idx - 1];
                    const prevProduced = prevRun
                      ? PRODUCED_ARTIFACTS[`${prevRun.project}/${prevRun.version}`]
                      : null;
                    const prevSkills = new Set(
                      (prevProduced?.skillFiles ?? []).map((s) => s.name)
                    );
                    const currentSkillNames = skillsInThisRun.map((s) => s.name);
                    const newlyAuthored = currentSkillNames.filter(
                      (n) => !prevSkills.has(n)
                    );
                    const carriedOver = currentSkillNames.filter((n) => prevSkills.has(n));
                    const dropped = [...prevSkills].filter(
                      (n) => !currentSkillNames.includes(n)
                    );
                    return (
                      <tr
                        key={run.version}
                        className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/runs/${run.project}/${run.version}`}
                            className="font-mono text-xs text-accent hover:underline"
                          >
                            {run.version}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          {skillsInThisRun.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              (no skills recorded)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {skillsInThisRun.map((s) => {
                                const isNew = !prevSkills.has(s.name);
                                return (
                                  <span
                                    key={s.name}
                                    className={
                                      isNew
                                        ? "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300"
                                        : "inline-flex items-center rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                                    }
                                  >
                                    {isNew && "✨ "}
                                    {s.name.replace(/\.md$/, "")}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-foreground">
                          {skillsInThisRun.length}
                        </td>
                        <td className="px-5 py-3 text-[11px]">
                          {newlyAuthored.length > 0 && (
                            <span className="text-amber-300">
                              +{newlyAuthored.length} authored
                            </span>
                          )}
                          {newlyAuthored.length > 0 && dropped.length > 0 && <span className="mx-1 text-muted-foreground">·</span>}
                          {dropped.length > 0 && (
                            <span className="text-red-400">
                              −{dropped.length} dropped
                            </span>
                          )}
                          {newlyAuthored.length === 0 && dropped.length === 0 && (
                            <span className="text-muted-foreground">no net change</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-amber-400" />
                ✨ newly authored in this run
              </span>
              <span className="ml-4 inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-border" />
                carried over from previous run
              </span>
            </p>
          </div>
        </section>
      )}

      {project.scoringWeights && (
        <section className="border-b border-border/60 bg-card/20">
          <div className="section-shell">
            <p className="section-kicker">Scoring weights</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              How this project is scored
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Defined in{" "}
              <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">
                evals/{project.id}/gad.json
              </code>
              . The composite score is a weighted sum of these dimensions. See{" "}
              <Link href="/methodology" className="text-accent hover:underline">
                /methodology
              </Link>{" "}
              for the formula and caps.
            </p>
            <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Dimension</th>
                    <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(project.scoringWeights)
                    .sort((a, b) => b[1] - a[1])
                    .map(([dim, w], idx) => (
                      <tr
                        key={dim}
                        className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                      >
                        <td className="px-5 py-3 font-mono text-xs">{dim}</td>
                        <td className="px-5 py-3 tabular-nums text-accent">{w.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
