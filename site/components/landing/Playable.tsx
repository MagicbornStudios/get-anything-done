"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EVAL_RUNS,
  PLAYABLE_INDEX,
  WORKFLOW_LABELS,
  type EvalRunRecord,
  type Workflow,
} from "@/lib/eval-data";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

function runKey(r: { project: string; version: string }) {
  return `${r.project}/${r.version}`;
}

const WORKFLOW_TINT: Record<Workflow, string> = {
  gad: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  bare: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  emergent: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

export default function Playable() {
  const runs = useMemo<EvalRunRecord[]>(
    () =>
      EVAL_RUNS.filter((r) => PLAYABLE_INDEX[runKey(r)]).sort((a, b) => {
        if (a.project !== b.project) return a.project.localeCompare(b.project);
        const av = parseInt(a.version.slice(1), 10) || 0;
        const bv = parseInt(b.version.slice(1), 10) || 0;
        return av - bv;
      }),
    []
  );

  // Default: bare/v3 (highest human review) if available, otherwise first.
  const defaultIndex = Math.max(
    0,
    runs.findIndex((r) => r.project === "escape-the-dungeon-bare" && r.version === "v3")
  );
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const selected = runs[selectedIndex];

  if (!selected) {
    return null;
  }

  const iframeSrc = PLAYABLE_INDEX[runKey(selected)]!;

  return (
    <section id="play" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Playable archive</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Every build we scored. <span className="gradient-text">Playable in your browser.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          These are the exact production builds the human reviewers scored — no rebuilds, no
          tweaks. Pick a run below and the iframe loads the static bundle from
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm"> /playable/&lt;project&gt;/&lt;version&gt;/</code>.
          Rate-limited runs with no functioning UI are omitted.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {runs.map((r, i) => {
            const active = i === selectedIndex;
            return (
              <button
                key={runKey(r)}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={[
                  "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20"
                    : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60 hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                    active ? "border-background/40 bg-background/20 text-accent-foreground" : WORKFLOW_TINT[r.workflow],
                  ].join(" ")}
                >
                  {WORKFLOW_LABELS[r.workflow]}
                </span>
                <span>{r.project.replace("escape-the-dungeon", "etd")}</span>
                <span className="tabular-nums">{r.version}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Gamepad2 size={14} className="text-accent" aria-hidden />
                playable: {selected.project}/{selected.version}
              </div>
              <a
                href={iframeSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
              >
                Open full screen
                <ExternalLink size={11} aria-hidden />
              </a>
            </div>
            <div className="aspect-[16/10] w-full">
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                title={`${selected.project} ${selected.version}`}
                className="h-full w-full bg-[#1a1a2e]"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline">{WORKFLOW_LABELS[selected.workflow]} · {selected.version}</Badge>
              {selected.requirementCoverage?.gate_failed ? (
                <Badge variant="danger">Gate failed</Badge>
              ) : (
                <Badge variant="success">Gate passed</Badge>
              )}
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-tight">{selected.project}</h3>
            <p className="text-xs text-muted-foreground">
              requirements {selected.requirementsVersion} · {selected.date}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Composite</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground">
                  {(selected.scores.composite ?? 0).toFixed(3)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Human</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground">
                  {(selected.humanReview?.score ?? 0).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Duration</dt>
                <dd className="text-sm font-medium tabular-nums text-foreground">
                  {selected.timing?.duration_minutes != null
                    ? `${selected.timing.duration_minutes}m`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Commits</dt>
                <dd className="text-sm font-medium tabular-nums text-foreground">
                  {selected.gitAnalysis?.total_commits ?? "—"}
                </dd>
              </div>
            </dl>

            {selected.humanReview?.notes && (
              <p className="mt-5 border-t border-border/60 pt-5 text-sm leading-6 text-muted-foreground">
                {selected.humanReview.notes}
              </p>
            )}

            <a
              href={`${REPO}/tree/main/evals/${selected.project}/${selected.version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              Source on GitHub
              <ExternalLink size={11} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
