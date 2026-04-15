"use client";

import { useEffect, useMemo, useState } from "react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import discoveryFindings from "@/data/discovery-findings.json";

/**
 * PlanningDiscoveryTab — phase 42.2-28; lives under /planning Workflows tab (subagent
 * discovery test battery).
 *
 * Three stacked panels:
 *   1. Terminal capture — live `gad startup` / `gad snapshot` / `gad skill list`
 *      output, captured via /api/dev/capture-cli in dev. Button to re-capture.
 *   2. Flow map — depth-0 entry points → read-chain of files agents reached,
 *      rendered as a grouped list (graph-lite). Unreached paths highlighted.
 *   3. Findings summary — mean confidence, P0/P1 gaps with fix status, per-agent
 *      confidence table.
 */

type Capture = {
  command: string;
  args: string[];
  full_command: string;
  timestamp: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
};

type Agent = {
  id: string;
  task_name: string;
  confidence: number;
  confidence_detail?: Record<string, number>;
  cli_commands: string[];
  skills_discovered: { id: string; workflow_read: boolean; workflow_ref?: string }[];
  skill_order: string[];
  gaps: string[];
};

type FlowNode = {
  id: string;
  kind: string;
  depth: number;
  label: string;
  reached_by: string[];
  status?: string;
};

type FlowEdge = {
  from: string;
  to: string;
  kind: string;
};

type Findings = typeof discoveryFindings & {
  agents: Agent[];
  flow_map: { nodes: FlowNode[]; edges: FlowEdge[] };
};

const COMMANDS: { key: string; label: string; hint: string }[] = [
  { key: "startup", label: "gad startup", hint: "session contract + next-action" },
  { key: "snapshot", label: "gad snapshot", hint: "full context rehydration" },
  { key: "skill-list", label: "gad skill list --paths", hint: "full inventory with paths" },
];

function ConfidenceBadge({ score, target }: { score: number; target: number }) {
  const ok = score >= target;
  const color = ok ? "text-green-400 border-green-700/50 bg-green-900/20" : "text-amber-400 border-amber-700/50 bg-amber-900/20";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono ${color}`}>
      {score.toFixed(1)} / {target.toFixed(1)}
    </span>
  );
}

function TerminalPanel() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCaptures = async () => {
    try {
      const res = await fetch("/api/dev/capture-cli");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCaptures(Array.isArray(data.captures) ? data.captures : []);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    loadCaptures();
  }, []);

  const runCapture = async (command: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/capture-cli", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCaptures(Array.isArray(data.all_captures) ? data.all_captures : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Group captures by command for the tab view.
  const byCommand = useMemo(() => {
    const map: Record<string, Capture[]> = {};
    for (const c of captures) {
      if (!map[c.command]) map[c.command] = [];
      map[c.command].push(c);
    }
    return map;
  }, [captures]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Capture live CLI output:</span>
        {COMMANDS.map((cmd) => (
          <button
            key={cmd.key}
            onClick={() => runCapture(cmd.key)}
            disabled={loading}
            className="rounded-md border border-border/70 bg-muted/30 px-3 py-1 text-xs font-mono hover:bg-muted/60 disabled:opacity-50"
            title={cmd.hint}
          >
            {loading ? "..." : cmd.label}
          </button>
        ))}
        {error && <span className="text-xs text-red-400">Error: {error}</span>}
      </div>

      {captures.length === 0 && (
        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          No captures yet. Click a button above to run the CLI and capture its output.
          In production builds without NODE_ENV=development, the capture endpoint is
          disabled and this panel stays empty — run <code className="font-mono">pnpm dev</code> on
          the site to enable it.
        </div>
      )}

      {COMMANDS.map((cmd) => {
        const commandCaptures = byCommand[cmd.key] || [];
        if (commandCaptures.length === 0) return null;
        const latest = commandCaptures[0];
        return (
          <div key={cmd.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">$ {latest.full_command}</span>
                <span className="text-xs text-muted-foreground/60">
                  {new Date(latest.timestamp).toLocaleString()}
                </span>
                {latest.exit_code !== 0 && (
                  <span className="text-xs text-red-400">exit={latest.exit_code}</span>
                )}
              </div>
            </div>
            <pre className="overflow-auto rounded-md border border-border/60 bg-black/60 p-3 text-[11px] leading-tight font-mono text-green-300 max-h-96 whitespace-pre-wrap">
              {latest.stdout || "(no stdout)"}
              {latest.stderr && <span className="text-red-300">{"\n" + latest.stderr}</span>}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function FlowMapPanel({ findings }: { findings: Findings }) {
  const { flow_map } = findings;

  const nodesByDepth = useMemo(() => {
    const map: Record<number, FlowNode[]> = {};
    for (const node of flow_map.nodes) {
      const depth = node.depth;
      if (!map[depth]) map[depth] = [];
      map[depth].push(node);
    }
    return map;
  }, [flow_map.nodes]);

  const depths = Object.keys(nodesByDepth).map(Number).sort((a, b) => a - b);

  const outbound = useMemo(() => {
    const map: Record<string, FlowEdge[]> = {};
    for (const edge of flow_map.edges) {
      if (!map[edge.from]) map[edge.from] = [];
      map[edge.from].push(edge);
    }
    return map;
  }, [flow_map.edges]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Read-chain flow map from the 2026-04-15 battery run. Depth-0 nodes are CLI entry
        points (files agents reached directly from a CLI command). Deeper nodes were
        reached by following references inside already-read files. Unreached nodes (red)
        are paths ≥1 agent needed but couldn't get to under strict CLI-only discovery.
      </p>
      {depths.map((depth) => (
        <div key={depth} className="space-y-2">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            Depth {depth} {depth === 0 ? "(entry points)" : ""}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {nodesByDepth[depth].map((node) => {
              const unreached = node.status === "unreached";
              const isEntry = node.kind === "entry";
              const border = unreached
                ? "border-red-700/60 bg-red-900/20"
                : isEntry
                ? "border-blue-700/60 bg-blue-900/20"
                : "border-border/60 bg-muted/20";
              return (
                <div key={node.id} className={`rounded-md border px-3 py-2 ${border}`}>
                  <div className="font-mono text-xs break-all">{node.label}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{node.kind}</span>
                    {node.reached_by.length > 0 ? (
                      <span>reached by: {node.reached_by.join(", ")}</span>
                    ) : (
                      <span className="text-red-400">UNREACHED</span>
                    )}
                  </div>
                  {outbound[node.id] && outbound[node.id].length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {outbound[node.id].map((edge, i) => (
                        <div key={i} className="text-[10px] font-mono text-muted-foreground">
                          → {edge.to} <span className="text-muted-foreground/60">({edge.kind})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FindingsSummaryPanel({ findings }: { findings: Findings }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Mean confidence</div>
          <ConfidenceBadge score={findings.mean_confidence} target={findings.target_confidence} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Min confidence</div>
          <ConfidenceBadge score={findings.min_confidence} target={findings.target_confidence} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Agents</div>
          <div className="font-mono text-sm">{findings.agent_count}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Regression?</div>
          <div className={`font-mono text-sm ${findings.regression ? "text-amber-400" : "text-green-400"}`}>
            {findings.regression ? "YES (below target)" : "no"}
          </div>
        </div>
        <div className="flex-1 text-right text-xs text-muted-foreground">
          Run: {new Date(findings.timestamp).toLocaleString()}
        </div>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
        <div className="text-muted-foreground">
          {findings.source_note}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Per-agent results</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Agent</th>
                <th className="px-2 py-1">Task</th>
                <th className="px-2 py-1">Confidence</th>
                <th className="px-2 py-1">Skills found</th>
                <th className="px-2 py-1">Gaps</th>
              </tr>
            </thead>
            <tbody>
              {findings.agents.map((agent) => (
                <tr key={agent.id} className="border-t border-border/40 align-top">
                  <td className="px-2 py-2 font-mono">{agent.id}</td>
                  <td className="px-2 py-2">{agent.task_name}</td>
                  <td className="px-2 py-2">
                    <ConfidenceBadge score={agent.confidence} target={findings.target_confidence} />
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">
                    {agent.skills_discovered.map((s) => s.id).join(", ")}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-muted-foreground">
                    {agent.gaps.length} gap{agent.gaps.length === 1 ? "" : "s"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">P0 gaps</div>
        <div className="space-y-1 text-xs">
          {findings.p0_gaps.map((gap) => (
            <div key={gap.id} className="flex gap-2">
              <span className={gap.status === "fixed" ? "text-green-400" : "text-amber-400"}>
                [{gap.status === "fixed" ? "✓" : "○"} {gap.status}]
              </span>
              <span>{gap.description}</span>
              {gap.fixed_in && <span className="text-muted-foreground/60">({gap.fixed_in})</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">P1 gaps</div>
        <div className="space-y-1 text-xs">
          {findings.p1_gaps.map((gap) => (
            <div key={gap.id} className="flex gap-2">
              <span className={gap.status === "fixed" ? "text-green-400" : "text-amber-400"}>
                [{gap.status === "fixed" ? "✓" : "○"} {gap.status}]
              </span>
              <span>{gap.description}</span>
              {gap.fixed_in && <span className="text-muted-foreground/60">({gap.fixed_in})</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Unreached paths</div>
        <div className="space-y-0.5 font-mono text-[11px] text-red-300">
          {findings.unreached_paths.map((p) => (
            <div key={p}>× {p}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlanningDiscoveryTab() {
  const findings = discoveryFindings as unknown as Findings;

  return (
    <SiteSection cid="planning-discovery-tab-site-section">
      <Identified as="PlanningDiscoveryTab">
        <div className="space-y-8">
          <SiteSectionHeading title="Subagent discovery test battery" />
          <div className="space-y-8">
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Live CLI terminal
              </h3>
              <TerminalPanel />
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Read-chain flow map
              </h3>
              <FlowMapPanel findings={findings} />
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Findings summary
              </h3>
              <FindingsSummaryPanel findings={findings} />
            </section>
          </div>
        </div>
      </Identified>
    </SiteSection>
  );
}
