import { AlertTriangle } from "lucide-react";
import { Ref } from "@/components/refs/Ref";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export default function StandardsDiscoverySection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading kicker="Discovery convention — .agents/skills/" />
      <SiteProse size="sm" className="mb-6 mt-4">
        The agentskills.io cross-client interoperability convention is the canonical location GAD is
        migrating toward (
        <Ref id="gad-80" />
        ). Skills installed at these paths become visible to any compliant client — Claude Code,
        Codex, Cursor, Windsurf, Augment, and others — without per-runtime copies.
      </SiteProse>
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/60 bg-card/60">
            <tr>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Scope
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Path
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Purpose
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/40">
              <td className="px-4 py-3 font-mono text-xs">Project</td>
              <td className="px-4 py-3 font-mono text-xs">&lt;project&gt;/.&lt;client&gt;/skills/</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">Client-native location</td>
            </tr>
            <tr className="border-b border-border/40 bg-sky-500/5">
              <td className="px-4 py-3 font-mono text-xs">Project</td>
              <td className="px-4 py-3 font-mono text-xs text-sky-300">
                &lt;project&gt;/.agents/skills/
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">Cross-client interoperability</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="px-4 py-3 font-mono text-xs">User</td>
              <td className="px-4 py-3 font-mono text-xs">~/.&lt;client&gt;/skills/</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">Client-native location</td>
            </tr>
            <tr className="bg-sky-500/5">
              <td className="px-4 py-3 font-mono text-xs">User</td>
              <td className="px-4 py-3 font-mono text-xs text-sky-300">~/.agents/skills/</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">Cross-client interoperability</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle size={14} className="text-rose-300" aria-hidden />
          <strong className="text-rose-200">Current GAD gap</strong>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          GAD workspace skills currently live at{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
            vendor/get-anything-done/skills/
          </code>{" "}
          — the repo root. This is neither the Claude-Code-native path nor the cross-client{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">.agents/skills/</code>{" "}
          convention. Worse:{" "}
          <strong className="text-foreground">
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad install</code> does not
            copy workspace skills to user projects at all
          </strong>{" "}
          — it only installs{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">commands/gad/*.md</code> as
          slash commands + agents + a single bundled skill. The full findability writeup is at{" "}
          <a
            href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/docs/SKILL-FINDABILITY-2026-04-09.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose-100 underline decoration-dotted"
          >
            .planning/docs/SKILL-FINDABILITY-2026-04-09.md
          </a>
          . Adopting the{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">.agents/skills/</code>{" "}
          convention is tracked as task 22-46.
        </p>
      </div>
    </SiteSection>
  );
}
