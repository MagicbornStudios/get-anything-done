"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta, EvalRunRecord, EvalScores } from "@/lib/eval-data";
import type { EditorSelection } from "./ProjectEditor";
import { InventoryGrid } from "./InventoryGrid";
import { TraitBar, type Trait } from "./TraitBar";
import { RadarChart, type RadarSeries } from "./RadarChart";
import { EditableField } from "./EditableField";

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
  "#60a5fa", "#f97316", "#a78bfa", "#34d399", "#fb7185", "#facc15",
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

// -- Type coercion ------------------------------------------------------------

/** Parse a string value back to its original type (number, boolean, null). */
function coerceValue(raw: string, originalType: string): unknown {
  if (originalType === "boolean") {
    const lower = raw.trim().toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    return raw;
  }
  if (originalType === "number") {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
    return raw;
  }
  if (originalType === "null" && raw.trim().toLowerCase() === "null") {
    return null;
  }
  return raw;
}

/** Infer type from an existing value to guide coercion. */
function inferType(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

/** Set a nested key by dot-path on a shallow-cloned object. */
function setByPath(obj: Record<string, unknown>, keyPath: string, value: unknown): Record<string, unknown> {
  const clone = structuredClone(obj);
  const parts = keyPath.split(".");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let cursor: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== "object") {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return clone;
}

/** Resolve a value from a nested object by dot-path. */
function getByPath(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split(".");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let cursor: any = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = cursor[part];
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return cursor;
}

// -- API helpers ---------------------------------------------------------------

async function updateProject(projectId: string, updates: Record<string, unknown>) {
  const res = await fetch(`/api/dev/evals/projects/${projectId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function updateSpecies(projectId: string, speciesName: string, updates: Record<string, unknown>) {
  const res = await fetch(`/api/dev/evals/projects/${projectId}/species/${speciesName}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function readFile(projectId: string, filePath: string): Promise<string | null> {
  const res = await fetch(
    `/api/dev/evals/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.content ?? null;
}

async function writeFile(projectId: string, filePath: string, content: string) {
  const res = await fetch(`/api/dev/evals/projects/${projectId}/files`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// -- Subcomponents -------------------------------------------------------------

function ProjectInspector({
  project,
  projectId,
}: {
  project: EvalProjectMeta;
  projectId: string;
}) {
  const saveField = useCallback(
    (field: string) => async (value: string) => {
      await updateProject(projectId, { [field]: value });
    },
    [projectId],
  );

  // -- Full project.json grid --
  const [projectJson, setProjectJson] = useState<Record<string, unknown> | null>(null);
  const [projectJsonLoading, setProjectJsonLoading] = useState(false);

  useEffect(() => {
    setProjectJson(null);
    setProjectJsonLoading(true);
    readFile(projectId, "project.json")
      .then((content) => {
        if (content) {
          try {
            setProjectJson(JSON.parse(content));
          } catch {
            setProjectJson(null);
          }
        }
      })
      .finally(() => setProjectJsonLoading(false));
  }, [projectId]);

  const handleProjectJsonEdit = useCallback(
    async (keyPath: string, newValue: string) => {
      if (!projectJson) return;
      const original = getByPath(projectJson, keyPath);
      const coerced = coerceValue(newValue, inferType(original));
      const updated = setByPath(projectJson, keyPath, coerced);
      await writeFile(projectId, "project.json", JSON.stringify(updated, null, 2));
      setProjectJson(updated);
    },
    [projectId, projectJson],
  );

  return (
    <div className="p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Project
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono">{projectId}</dd>
        </div>
        <EditableField
          label="Name"
          value={project.name}
          onSave={saveField("name")}
        />
        <EditableField
          label="Domain"
          value={project.domain}
          onSave={saveField("domain")}
          mono
          placeholder="game, site, cli..."
        />
        <EditableField
          label="Tech Stack"
          value={project.techStack}
          onSave={saveField("techStack")}
          mono
          placeholder="kaplay, next.js..."
        />
        <EditableField
          label="Description"
          value={project.description}
          onSave={saveField("description")}
          multiline
        />
        <EditableField
          label="Tagline"
          value={(project as unknown as Record<string, unknown>).tagline as string ?? null}
          onSave={saveField("tagline")}
          placeholder="Short tagline..."
        />
      </dl>

      {/* Full project.json grid */}
      <div className="mt-4 border-t border-border/40 pt-3">
        {projectJsonLoading && (
          <p className="text-[10px] text-muted-foreground/40">Loading project.json...</p>
        )}
        {projectJson && (
          <InventoryGrid data={projectJson} title="project.json" onEdit={handleProjectJsonEdit} />
        )}
      </div>
    </div>
  );
}

function SpeciesInspector({
  speciesRow,
  runs,
  projectId,
}: {
  speciesRow: EvalProjectMeta;
  runs: EvalRunRecord[];
  projectId: string;
}) {
  const speciesName = speciesRow.species ?? speciesRow.workflow ?? "default";
  const latestRun = runs[0];

  // Requirements.md editor
  const [reqContent, setReqContent] = useState<string | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqEditing, setReqEditing] = useState(false);
  const [reqDraft, setReqDraft] = useState("");
  const [reqSaving, setReqSaving] = useState(false);

  useEffect(() => {
    setReqContent(null);
    setReqEditing(false);
    const filePath = `species/${speciesName}/REQUIREMENTS.md`;
    setReqLoading(true);
    readFile(projectId, filePath)
      .then((content) => {
        setReqContent(content);
        if (content) setReqDraft(content);
      })
      .finally(() => setReqLoading(false));
  }, [projectId, speciesName]);

  const saveRequirements = useCallback(async () => {
    setReqSaving(true);
    try {
      await writeFile(projectId, `species/${speciesName}/REQUIREMENTS.md`, reqDraft);
      setReqContent(reqDraft);
      setReqEditing(false);
    } finally {
      setReqSaving(false);
    }
  }, [projectId, speciesName, reqDraft]);

  const saveSpeciesField = useCallback(
    (field: string) => async (value: string) => {
      await updateSpecies(projectId, speciesName, { [field]: value });
    },
    [projectId, speciesName],
  );

  // -- Scoring weights save handler --
  const handleScoringWeightEdit = useCallback(
    async (keyPath: string, newValue: string) => {
      const existing = speciesRow.scoringWeights ?? {};
      const original = getByPath(existing, keyPath);
      const coerced = coerceValue(newValue, inferType(original));
      const updated = setByPath(existing, keyPath, coerced);
      await updateProject(projectId, { scoring: updated });
    },
    [projectId, speciesRow.scoringWeights],
  );

  // -- Constraints save handler --
  const handleConstraintEdit = useCallback(
    async (keyPath: string, newValue: string) => {
      const existing = speciesRow.constraints ?? {};
      const original = getByPath(existing, keyPath);
      const coerced = coerceValue(newValue, inferType(original));
      const updated = setByPath(existing, keyPath, coerced);
      await updateSpecies(projectId, speciesName, { constraints: updated });
    },
    [projectId, speciesName, speciesRow.constraints],
  );

  // -- Full species.json grid --
  const [speciesJson, setSpeciesJson] = useState<Record<string, unknown> | null>(null);
  const [speciesJsonLoading, setSpeciesJsonLoading] = useState(false);

  useEffect(() => {
    setSpeciesJson(null);
    const filePath = `species/${speciesName}/species.json`;
    setSpeciesJsonLoading(true);
    readFile(projectId, filePath)
      .then((content) => {
        if (content) {
          try {
            setSpeciesJson(JSON.parse(content));
          } catch {
            setSpeciesJson(null);
          }
        }
      })
      .finally(() => setSpeciesJsonLoading(false));
  }, [projectId, speciesName]);

  const handleSpeciesJsonEdit = useCallback(
    async (keyPath: string, newValue: string) => {
      if (!speciesJson) return;
      const original = getByPath(speciesJson, keyPath);
      const coerced = coerceValue(newValue, inferType(original));
      const updated = setByPath(speciesJson, keyPath, coerced);
      const filePath = `species/${speciesName}/species.json`;
      await writeFile(projectId, filePath, JSON.stringify(updated, null, 2));
      setSpeciesJson(updated);
    },
    [projectId, speciesName, speciesJson],
  );

  // Radar chart series from all generations with scores
  const radarData = useMemo(() => {
    const runsWithScores = runs.filter(
      (r) => r.scores && Object.values(r.scores).some((v) => v != null),
    );
    if (runsWithScores.length === 0) return null;
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
          <dd className="font-mono">{speciesName}</dd>
        </div>
        <EditableField
          label="Workflow"
          value={speciesRow.contextFramework ?? speciesRow.workflow}
          onSave={saveSpeciesField("workflow")}
          mono
          placeholder="gad, bare, emergent..."
        />
        <EditableField
          label="Description"
          value={speciesRow.description}
          onSave={saveSpeciesField("description")}
          multiline
        />
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
              <dd className="font-mono">{latestRun.date ?? "---"}</dd>
            </div>
          </>
        )}
      </dl>

      {radarData && (
        <RadarChart
          axes={radarData.axes}
          series={radarData.series}
          title="Score Comparison"
        />
      )}

      {speciesRow.scoringWeights && (
        <InventoryGrid data={speciesRow.scoringWeights} title="Scoring Weights" onEdit={handleScoringWeightEdit} />
      )}
      {speciesRow.constraints && (
        <InventoryGrid data={speciesRow.constraints} title="Constraints" onEdit={handleConstraintEdit} />
      )}

      {/* Requirements.md editor */}
      <div className="mt-4 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Requirements
          </h3>
          {reqContent !== null && !reqEditing && (
            <button
              type="button"
              onClick={() => {
                setReqDraft(reqContent);
                setReqEditing(true);
              }}
              className="text-[9px] text-accent/50 hover:text-accent"
            >
              edit
            </button>
          )}
          {reqContent === null && !reqLoading && (
            <button
              type="button"
              onClick={() => {
                setReqDraft("# Requirements\n\n");
                setReqEditing(true);
              }}
              className="text-[9px] text-accent/50 hover:text-accent"
            >
              create
            </button>
          )}
        </div>

        {reqLoading && (
          <p className="text-[10px] text-muted-foreground/40 mt-1">Loading...</p>
        )}

        {reqEditing ? (
          <div className="mt-1.5">
            <textarea
              value={reqDraft}
              onChange={(e) => setReqDraft(e.target.value)}
              disabled={reqSaving}
              rows={12}
              className={cn(
                "w-full rounded border border-accent/30 bg-background px-2 py-1.5 text-[11px] font-mono leading-relaxed text-foreground focus:border-accent focus:outline-none resize-y",
                reqSaving && "opacity-50",
              )}
            />
            <div className="flex gap-1.5 mt-1">
              <button
                type="button"
                onClick={saveRequirements}
                disabled={reqSaving}
                className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
              >
                {reqSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReqEditing(false);
                  setReqDraft(reqContent ?? "");
                }}
                className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : reqContent ? (
          <pre className="mt-1.5 max-h-40 overflow-y-auto rounded bg-muted/20 p-2 text-[10px] font-mono leading-relaxed text-foreground/70 whitespace-pre-wrap cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => {
              setReqDraft(reqContent);
              setReqEditing(true);
            }}
            title="Click to edit"
          >
            {reqContent.slice(0, 800)}
            {reqContent.length > 800 && "\n..."}
          </pre>
        ) : null}
      </div>

      {/* Full species.json grid */}
      <div className="mt-4 border-t border-border/40 pt-3">
        {speciesJsonLoading && (
          <p className="text-[10px] text-muted-foreground/40">Loading species.json...</p>
        )}
        {speciesJson && (
          <InventoryGrid data={speciesJson} title="species.json" onEdit={handleSpeciesJsonEdit} />
        )}
      </div>
    </div>
  );
}

function PublishBadge({
  projectId,
  species,
  version,
}: {
  projectId: string;
  species: string;
  version: string;
}) {
  const [published, setPublished] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPublished(null);
    fetch(
      `/api/dev/evals/projects/${projectId}/species/${species}/generations/${version}/publish`,
    )
      .then((res) => res.json())
      .then((data) => setPublished(data.isPublished ?? false))
      .catch(() => setPublished(false));
  }, [projectId, species, version]);

  const toggle = useCallback(async () => {
    if (busy || published === null) return;
    setBusy(true);
    const prev = published;
    setPublished(!prev);
    try {
      const res = await fetch(
        `/api/dev/evals/projects/${projectId}/species/${species}/generations/${version}/publish`,
        { method: prev ? "DELETE" : "POST" },
      );
      if (!res.ok) {
        setPublished(prev);
        const data = await res.json();
        console.error("publish toggle failed:", data.error);
      }
    } catch {
      setPublished(prev);
    } finally {
      setBusy(false);
    }
  }, [projectId, species, version, published, busy]);

  if (published === null) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
          published
            ? "bg-emerald-400/15 text-emerald-400"
            : "bg-muted-foreground/10 text-muted-foreground/60",
        )}
      >
        {published ? "Published" : "Draft"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={cn(
          "text-[10px] transition-colors",
          published
            ? "text-red-400/60 hover:text-red-400"
            : "text-accent/60 hover:text-accent",
          busy && "opacity-50",
        )}
      >
        {busy ? "..." : published ? "unpublish" : "publish"}
      </button>
    </div>
  );
}

function GenerationInspector({
  run,
  speciesRow,
  speciesRuns,
  projectId,
  onCompare,
}: {
  run: EvalRunRecord;
  speciesRow: EvalProjectMeta | undefined;
  speciesRuns: EvalRunRecord[];
  projectId: string;
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
          <dd className="font-mono">{run.species ?? "---"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <PublishBadge
              projectId={projectId}
              species={run.species ?? run.project}
              version={run.version}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Date</dt>
          <dd className="font-mono">{run.date ?? "---"}</dd>
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

      {traits.length > 0 && <TraitBar traits={traits} title="Scores" />}

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

// -- Main component ------------------------------------------------------------

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
  const projectId = project.project ?? project.id.split("/")[0];

  if (selection.kind === "project") {
    return (
      <SiteSection
        cid="project-editor-inspector-project-site-section"
        sectionShell={false}
        className="border-b-0"
      >
        <ProjectInspector project={project} projectId={projectId} />
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
          projectId={projectId}
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
        projectId={projectId}
        onCompare={onCompare}
      />
    </SiteSection>
  );
}
