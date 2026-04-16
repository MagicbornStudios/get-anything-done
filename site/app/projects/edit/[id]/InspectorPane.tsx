"use client";

import { SiteSection } from "@/components/site";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";
import type { EditorSelection } from "./ProjectEditor";

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
        {speciesRow.scoringWeights && (
          <div>
            <dt className="text-muted-foreground mb-1">Scoring Weights</dt>
            <dd>
              {Object.entries(speciesRow.scoringWeights).map(([k, v]) => (
                <div key={k} className="flex justify-between font-mono">
                  <span className="text-muted-foreground">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function GenerationInspector({
  run,
  speciesRow,
}: {
  run: EvalRunRecord;
  speciesRow: EvalProjectMeta | undefined;
}) {
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
    </div>
  );
}

export function InspectorPane({
  project,
  allProjects,
  allRuns,
  selection,
}: {
  project: EvalProjectMeta;
  allProjects: EvalProjectMeta[];
  allRuns: EvalRunRecord[];
  selection: EditorSelection;
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
      <GenerationInspector run={run} speciesRow={speciesRow} />
    </SiteSection>
  );
}
