"use client";

import { useMemo } from "react";
import { SiteSection } from "@/components/site";
import type { EvalProjectMeta, EvalRunRecord, EvalScores } from "@/lib/eval-data";
import type { EditorSelection } from "./ProjectEditor";
import { InventoryGrid } from "./InventoryGrid";
import { TraitBar, type Trait } from "./TraitBar";
import { RadarChart, type RadarSeries } from "./RadarChart";

const SCORE_LABELS: Record<string, string> = {
  requirement_coverage: "Req Coverage",
  planning_quality: "Planning",
  per_task_discipline: "Discipline",
  skill_accuracy: "Skill Accuracy",
  time_efficiency: "Time Efficiency",
  human_review: "Human Review",
  workflow_emergence: "Workflow Emergence",
  implementation_quality: "Impl Quality",
  iteration_evidence: "Iteration Evidence",
  composite: "Composite",
};

const SERIES_COLORS = [
  "#60a5fa", // blue-400
  "#f97316", // orange-500
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#fb7185", // rose-400
  "#facc15", // yellow-400
];

function scoresToTraits(scores: EvalScores): Trait[] {
  return Object.entries(scores)
    .filter(([, v]) => v != null && typeof v === "number")
    .map(([key, value]) => ({
      key,
      label: SCORE_LABELS[key] ?? key.replace(/_/g, " "),
      value: value as number,
    }));
}

function scoresToAxesAndValues(scores: EvalScores): { axes: string[]; values: number[] } {
  const entries = Object.entries(scores).filter(
    ([k, v]) => v != null && typeof v === "number" && k !== "composite",
  );
  return {
    axes: entries.map(([k]) => SCORE_LABELS[k] ?? k.replace(/_/g, " ")),
    values: entries.map(([, v]) => v as number),
  };
}

function ProjectInspector({ project }: { project: EvalProjectMeta }) {
  return (
    <div className="p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Project
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono">{project.project ?? project.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Domain</dt>
          <dd className="font-mono">{project.domain ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tech Stack</dt>
          <dd className="font-mono">{project.techStack ?? "—"}</dd>
        </div>
        {project.description && (
          <div>
            <dt className="text-muted-foreground">Description</dt>
            <dd className="text-[11px] text-foreground/80 mt-1 leading-relaxed">
              {project.description}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SpeciesInspector({
  speciesRow,
  runs,
}: {
  speciesRow: EvalProjectMeta;
  runs: EvalRunRecord[];
}) {
  const latestRun = runs[0];

  // Build radar chart series from all generations with scores
  const radarData = useMemo(() => {
    const runsWithScores = runs.filter(
      (r) => r.scores && Object.values(r.scores).some((v) => v != null),
    );
    if (runsWithScores.length === 0) return null;

    // Use the first run's keys as the canonical axes (excluding composite)
    const first = runsWithScores[0];
    const { axes } = scoresToAxesAndValues(first.scores);
    if (axes.length < 3) return null;

    const series: RadarSeries[] = runsWithScores.map((r, i) => {
      const { values } = scoresToAxesAndValues(r.scores);
      return {
        label: r.version,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        values,
      };
    });
    return { axes, series };
  }, [runs]);

  return (
    <div className="p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Species
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-mono">{speciesRow.species ?? speciesRow.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Framework</dt>
          <dd className="font-mono">
            {speciesRow.contextFramework ?? speciesRow.workflow ?? "none"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Generations</dt>
          <dd className="font-mono">{runs.length}</dd>
        </div>
        {latestRun && (
          <>
            <div>
              <dt className="text-muted-foreground">Latest</dt>
              <dd className="font-mono">{latestRun.version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-mono">{latestRun.date ?? "—"}</dd>
            </div>
          </>
        )}
        {speciesRow.description && (
          <div>
            <dt className="text-muted-foreground">Description</dt>
            <dd className="text-[11px] text-foreground/80 mt-1 leading-relaxed">
              {speciesRow.description}
            </dd>
          </div>
        )}
      </dl>

      {/* Radar chart overlaying all generations */}
      {radarData && (
        <RadarChart
          axes={radarData.axes}
          series={radarData.series}
          title="Score Comparison"
        />
      )}

      {speciesRow.scoringWeights && (
        <InventoryGrid data={speciesRow.scoringWeights} title="Scoring Weights" />
      )}
      {speciesRow.constraints && (
        <InventoryGrid data={speciesRow.constraints} title="Constraints" />
      )}
    </div>
  );
}

function GenerationInspector({
  run,
  speciesRow,
  speciesRuns,
  onCompare,
}: {
  run: EvalRunRecord;
  speciesRow: EvalProjectMeta | undefined;
  speciesRuns: EvalRunRecord[];
  onCompare?: (species: string, versionA: string, versionB: string) => void;
}) {
  const traits = scoresToTraits(run.scores);

  return (
    <div className="p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Generation
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd className="font-mono">{run.version}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Species</dt>
          <dd className="font-mono">{run.species ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Date</dt>
          <dd className="font-mono">{run.date ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trace Schema</dt>
          <dd className="font-mono">v{run.traceSchemaVersion}</dd>
        </div>
        {run.gadVersion && (
          <div>
            <dt className="text-muted-foreground">GAD Version</dt>
            <dd className="font-mono">{run.gadVersion}</dd>
          </div>
        )}
        {run.frameworkVersion && (
          <div>
            <dt className="text-muted-foreground">Framework</dt>
            <dd className="font-mono">{run.frameworkVersion}</dd>
          </div>
        )}
        {run.runtimeIdentity && (
          <div>
            <dt className="text-muted-foreground">Runtime</dt>
            <dd className="font-mono text-[10px]">
              {JSON.stringify(run.runtimeIdentity, null, 0).slice(0, 120)}
            </dd>
          </div>
        )}

        {/* Playable link */}
        <div className="mt-4 pt-3 border-t border-border/40">
          <a
            href={`/playable/${run.project}/${run.species}/${run.version}/index.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline text-[11px]"
          >
            Open playable build in new tab &rarr;
          </a>
        </div>
        <div>
          <a
            href={`/runs/${run.project}/${run.version}`}
            className="text-accent hover:underline text-[11px]"
          >
            View full run report &rarr;
          </a>
        </div>
      </dl>

      {/* Trait bars for scores */}
      {traits.length > 0 && <TraitBar traits={traits} title="Scores" />}

      {/* Compare with another generation */}
      {onCompare && speciesRuns.length > 1 && (
        <div className="px-0 py-2 border-t border-border/40 mt-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Compare
          </h3>
          <div className="flex flex-wrap gap-1">
            {speciesRuns
              .filter((r) => r.version !== run.version)
              .map((r) => (
                <button
                  key={r.version}
                  type="button"
                  onClick={() =>
                    onCompare(
                      run.species ?? run.project,
                      run.version,
                      r.version,
                    )
                  }
                  className="rounded border border-border/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:border-accent/60 hover:text-foreground transition-colors"
                >
                  vs {r.version}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function InspectorPane({
  project,
  allProjects,
  allRuns,
  selection,
  onCompare,
}: {
  project: EvalProjectMeta;
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
  selection: EditorSelection;
  onCompare?: (species: string, versionA: string, versionB: string) => void;
}) {
  if (selection.kind === "project") {
    return (
      <SiteSection
        cid="project-editor-inspector-project-site-section"
        sectionShell={false}
        className="border-b-0"
      >
        <ProjectInspector project={project} />
      </SiteSection>
    );
  }

  const speciesRow = allProjects.find(
    (p) => (p.species ?? p.workflow) === selection.species,
  );

  const speciesRuns = allRuns
    .filter((r) => (r.species ?? r.project) === selection.species)
    .sort((a, b) => {
      const va = parseInt(a.version.replace("v", ""), 10);
      const vb = parseInt(b.version.replace("v", ""), 10);
      return vb - va;
    });

  if (selection.kind === "species") {
    return (
      <SiteSection
        cid="project-editor-inspector-species-site-section"
        sectionShell={false}
        className="border-b-0"
      >
        <SpeciesInspector
          speciesRow={speciesRow ?? project}
          runs={speciesRuns}
        />
      </SiteSection>
    );
  }

  // generation
  const run = speciesRuns.find((r) => r.version === selection.version);
  if (!run) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Generation {selection.version} not found in trace data
      </div>
    );
  }

  return (
    <SiteSection
      cid="project-editor-inspector-generation-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <GenerationInspector
        run={run}
        speciesRow={speciesRow}
        speciesRuns={speciesRuns}
        onCompare={onCompare}
      />
    </SiteSection>
  );
}
