import Link from "next/link";
import { Download, FileArchive, Play, Sprout, TreePine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVAL_RUNS, EVAL_TEMPLATES, PLANNING_ZIPS, PROJECT_LABELS, WORKFLOW_LABELS, playableUrl, type Workflow } from "@/lib/eval-data";

interface ProjectCard {
  project: string;
  mode: "greenfield" | "brownfield";
  workflow: Workflow;
  description: string;
  status: "active" | "planned";
}

const PROJECTS: ProjectCard[] = [
  {
    project: "escape-the-dungeon",
    mode: "greenfield",
    workflow: "gad",
    description: "Full GAD framework from empty repo. Every phase planned, every task committed with an id, every decision captured.",
    status: "active",
  },
  {
    project: "escape-the-dungeon-bare",
    mode: "greenfield",
    workflow: "bare",
    description: "No framework. No CLI. The agent gets AGENTS.md + REQUIREMENTS.xml + two bootstrap skills and is told to organise itself however it wants.",
    status: "active",
  },
  {
    project: "escape-the-dungeon-emergent",
    mode: "greenfield",
    workflow: "emergent",
    description: "No framework, but inherits skills from previous bare/emergent runs. Evolves them in place and ships a CHANGELOG documenting what was rewritten.",
    status: "active",
  },
  {
    project: "etd-brownfield-gad",
    mode: "brownfield",
    workflow: "gad",
    description: "Extends the bare v3 baseline with v4 pressure requirements under the full GAD framework. Tests whether structured planning pays off on codebase extension.",
    status: "planned",
  },
  {
    project: "etd-brownfield-bare",
    mode: "brownfield",
    workflow: "bare",
    description: "Same bare v3 baseline, same v4 extensions, no framework. The control condition for the freedom-hypothesis re-test.",
    status: "planned",
  },
  {
    project: "etd-brownfield-emergent",
    mode: "brownfield",
    workflow: "emergent",
    description: "Bare v3 baseline + v4 extensions with inherited skills from round 3 emergent runs. The most experienced configuration.",
    status: "planned",
  },
];

function projectRuns(project: string) {
  return EVAL_RUNS.filter((r) => r.project === project);
}

function latestRun(project: string) {
  const runs = projectRuns(project);
  if (runs.length === 0) return null;
  return runs.reduce((a, b) => {
    const av = parseInt(a.version.slice(1), 10) || 0;
    const bv = parseInt(b.version.slice(1), 10) || 0;
    return av >= bv ? a : b;
  });
}

function findTemplate(project: string) {
  return EVAL_TEMPLATES.find((t) => t.project === project);
}
function findPlanning(project: string) {
  return PLANNING_ZIPS.find((p) => p.project === project);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function Projects() {
  const greenfield = PROJECTS.filter((p) => p.mode === "greenfield");
  const brownfield = PROJECTS.filter((p) => p.mode === "brownfield");

  const renderCard = (p: ProjectCard) => {
    const runs = projectRuns(p.project);
    const latest = latestRun(p.project);
    const template = findTemplate(p.project);
    const planning = findPlanning(p.project);
    const playable = latest ? playableUrl(latest) : null;

    return (
      <Card key={p.project} className="flex h-full flex-col transition-colors hover:border-accent/60">
        <CardHeader>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge variant="outline">{WORKFLOW_LABELS[p.workflow]}</Badge>
            {p.status === "planned" ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                planned
              </Badge>
            ) : (
              <Badge variant="success">active</Badge>
            )}
          </div>
          <CardTitle className="text-lg">
            <Link
              href={`/projects/${p.project}`}
              className="transition-colors hover:text-accent"
            >
              {PROJECT_LABELS[p.project] ?? p.project}
            </Link>
          </CardTitle>
          <CardDescription className="font-mono text-[11px]">{p.project}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="text-sm leading-6 text-muted-foreground">{p.description}</p>

          {runs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {runs.map((r) => (
                <Link
                  key={r.version}
                  href={`/runs/${r.project}/${r.version}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                >
                  {r.version}
                  {r.humanReview?.score != null && (
                    <span className="text-accent">· {r.humanReview.score.toFixed(2)}</span>
                  )}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4 text-[11px]">
            {planning && (
              <a
                href={planning.zipPath}
                download
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <Download size={10} aria-hidden />
                planning ({formatBytes(planning.bytes)})
              </a>
            )}
            {template && (
              <a
                href={template.zipPath}
                download
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <FileArchive size={10} aria-hidden />
                template
              </a>
            )}
            {playable && (
              <a
                href={playable}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent transition-colors hover:bg-accent/20"
              >
                <Play size={10} aria-hidden />
                play latest
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <section id="projects" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Eval projects</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Three greenfield conditions. <span className="gradient-text">Three brownfield.</span>{" "}
          Same spec, different constraints.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Greenfield runs build the game from nothing. Brownfield runs inherit a codebase —
          specifically the bare v3 build (the highest human-reviewed run to date) — and try to
          extend it under v4 pressure requirements. If the freedom hypothesis survives
          brownfield, it&apos;s real. If GAD finally wins on extension, that tells us the
          framework&apos;s value is in maintenance, not creation.
        </p>

        <div className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <Sprout size={18} className="text-emerald-400" aria-hidden />
            <h3 className="text-2xl font-semibold tracking-tight">Greenfield — rounds 1 through 3 shipped</h3>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {greenfield.map(renderCard)}
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <TreePine size={18} className="text-amber-400" aria-hidden />
            <h3 className="text-2xl font-semibold tracking-tight">Brownfield — round 1 planned on v4</h3>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {brownfield.map(renderCard)}
          </div>
        </div>
      </div>
    </section>
  );
}
