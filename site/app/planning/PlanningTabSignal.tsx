import type { Signal } from "@/lib/catalog.generated";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

interface Props {
  signal: Signal;
}

/**
 * /planning -> Workflows tab → Signal band (task 44-21). Pure reducer view over
 * `.planning/.trace-events.jsonl` (gad-framework scope only). Surfaces:
 *
 *   1. Top files by tool_use count
 *   2. Top skills by trigger_skill invocation
 *   3. Tool mix percentage histogram
 *   4. Default vs subagent split + role breakdown
 *
 * v2 (NOT shipped): Bash command path extraction, WebFetch URL frequency,
 * tool/skill n-gram sequences (frequent-subgraph mining via the same
 * pattern as `synthesizeWorkflowTraceData`), per-session trends.
 */
export function PlanningTabSignal({ signal }: Props) {
  const toolEntries = Object.entries(signal.toolMix).sort(
    (a, b) => b[1].count - a[1].count
  );
  const roleEntries = Object.entries(signal.agentSplit.byRole).sort(
    (a, b) => b[1] - a[1]
  );
  const topRoles = roleEntries
    .slice(0, 5)
    .map(([role, count]) => `${role} (${count})`)
    .join(", ");

  return (
    <SiteSection cid="planning-signal-site-section">
      <Identified as="PlanningTabSignal">
        <div className="space-y-8">
          <MethodologyCallout />

          <header className="border-l-4 border-cyan-500/40 pl-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Signal
              </h2>
              <span className="tabular-nums text-sm text-muted-foreground">
                {signal.totalEvents} tool_use events
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Trace-based agent behavior — what the coding agent is actually
              touching, ranked. Pure reducers over the gad-framework slice of
              <code className="ml-1 text-foreground/80">
                .planning/.trace-events.jsonl
              </code>
              .
            </p>
          </header>

          <Section title="Top files" subtitle="Ranked by tool_use count">
            {signal.topFiles.length === 0 ? (
              <EmptyState message="No file-touch events recorded yet." />
            ) : (
              <Table
                headers={["#", "path", "count"]}
                rows={signal.topFiles.map((f, i) => [
                  String(i + 1),
                  <span key="p" className="font-mono text-xs text-foreground/90">
                    {f.path}
                  </span>,
                  <span key="c" className="tabular-nums">
                    {f.count}
                  </span>,
                ])}
              />
            )}
          </Section>

          <Section
            title="Top skills"
            subtitle="Ranked by trigger_skill invocation"
          >
            {signal.topSkills.length === 0 ? (
              <EmptyState message="No trigger_skill tags in the trace yet — skills are not yet stamping their invocations (decision gad-178 v2 work)." />
            ) : (
              <Table
                headers={["#", "skill", "count"]}
                rows={signal.topSkills.map((s, i) => [
                  String(i + 1),
                  <span key="s" className="text-foreground/90">{s.skill}</span>,
                  <span key="c" className="tabular-nums">
                    {s.count}
                  </span>,
                ])}
              />
            )}
          </Section>

          <Section title="Tool mix" subtitle="Share of all tool_use events">
            {toolEntries.length === 0 ? (
              <EmptyState message="No tool_use events recorded yet." />
            ) : (
              <div className="space-y-2">
                {toolEntries.map(([tool, entry]) => (
                  <ToolBar
                    key={tool}
                    tool={tool}
                    count={entry.count}
                    pct={entry.pct}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Agent split" subtitle="Default session vs subagent">
            <div className="grid grid-cols-2 gap-3">
              <SplitCell
                label="Default (main session)"
                count={signal.agentSplit.default}
              />
              <SplitCell label="Subagents" count={signal.agentSplit.sub} />
            </div>
            {topRoles && (
              <p className="mt-3 text-xs text-muted-foreground">
                Top subagent roles: {topRoles}
              </p>
            )}
          </Section>
        </div>
      </Identified>
    </SiteSection>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/60 bg-muted/10">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className="border-b border-border/40 last:border-b-0"
            >
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolBar({
  tool,
  count,
  pct,
}: {
  tool: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 shrink-0 font-mono text-foreground/90">{tool}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-sm border border-border/60 bg-muted/20">
        <div
          className="absolute inset-y-0 left-0 bg-cyan-500/30"
          style={{ width: `${Math.max(0.5, pct)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
        {count} ({pct}%)
      </span>
    </div>
  );
}

function SplitCell({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {count}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function MethodologyCallout() {
  return (
    <details className="rounded-md border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-foreground/90">
        What this tab is
      </summary>
      <div className="mt-2 space-y-2 leading-6">
        <p>
          Pure reducers over the <code>gad-framework</code> slice of{" "}
          <code className="text-foreground/80">
            .planning/.trace-events.jsonl
          </code>
          . v1 surfaces the simplest possible signal: top files, top skills,
          tool mix, and default vs subagent split.
        </p>
        <p>
          Deferred to v2: Bash command path extraction, WebFetch URL frequency,
          tool/skill n-gram sequences (the same frequent-subgraph mining the
          Workflows tab uses for emergent detection), per-session trends.
        </p>
      </div>
    </details>
  );
}
