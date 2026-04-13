import Link from "next/link";
import { CheckCircle2, Plug, XCircle } from "lucide-react";
import { AGENT_RUNTIMES } from "@/app/methodology/methodology-shared";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyAgentRuntimesSection() {
  return (
    <SiteSection>
      <Identified as="MethodologyAgentRuntimesSection">
      <Identified as="MethodologyAgentRuntimesHeading">
        <SiteSectionHeading
          icon={Plug}
          kicker="Agent runtimes"
          title="Which coding agents can produce trace v4 data"
        />
        <SiteProse size="md" className="mt-3">
        Trace schema v4 (phase 25) needs to capture every tool call, skill invocation, and subagent
        spawn with inputs, outputs, and timestamps. The only reliable way to get that data is from
        inside the coding agent&apos;s runtime via hooks or callbacks. Agents without a hook runtime
        are <strong className="text-foreground">explicitly unsupported</strong> for GAD evaluation
        &mdash; we&apos;re not going to screen-scrape stdout. Decision{" "}
        <Link href="/planning" className="text-accent hover:underline">
          gad-53
        </Link>{" "}
        pins this.
        </SiteProse>
      </Identified>

      <Identified as="MethodologyAgentRuntimesTable" className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Agent</th>
              <th className="px-5 py-3 font-medium">Hook runtime</th>
              <th className="px-5 py-3 font-medium">Trace v4 support</th>
              <th className="px-5 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {AGENT_RUNTIMES.map((row, idx) => (
              <tr
                key={row.agent}
                className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
              >
                <td className="px-5 py-3 font-semibold text-foreground">{row.agent}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{row.hook}</td>
                <td className="px-5 py-3">
                  {row.supported ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 size={14} aria-hidden />
                      supported
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <XCircle size={14} aria-hidden />
                      unsupported
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Identified>

      <Identified as="MethodologyAgentRuntimesMultiAgent" className="mt-8 rounded-2xl border border-border/70 bg-card/40 p-6">
        <p className="text-xs uppercase tracking-wider text-accent">
          Multi-agent support (decision gad-55)
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Agents beyond Claude Code are supported through{" "}
          <strong className="text-foreground">converters</strong>, not through per-agent trace code. A
          converter reads the target agent&apos;s native session format and emits GAD trace schema v4.
          The same{" "}
          <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">
            /runs/[project]/[version]
          </code>{" "}
          page renders it. Codex&apos;s{" "}
          <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">Running</code>/
          <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">Ran</code> stream format is
          parseable but requires streaming detection; Aider&apos;s Python callbacks are straightforward
          to hook into. Phase 25 ships the Claude Code converter first; Codex and Aider converters are
          future sub-phases if and when we want to run cross-agent comparisons.
        </p>
      </Identified>
      </Identified>
    </SiteSection>
  );
}
