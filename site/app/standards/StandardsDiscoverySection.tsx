import { AlertTriangle } from "lucide-react";
import { Ref } from "@/components/refs/Ref";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
export default function StandardsDiscoverySection() {
  return (
    <SiteSection cid="standards-discovery-section-site-section" tone="muted">
      <Identified as="StandardsDiscoverySection">
      <SiteSectionHeading kicker="Discovery convention - skills/" />
      <SiteProse size="sm" className="mb-6 mt-4">
        The agentskills.io cross-client interoperability convention is the canonical location GAD is
        migrating toward (<Ref id="gad-80" />). Skills installed at these paths become visible to
        any compliant client - Claude Code, Codex, Cursor, Windsurf, Augment, and others -
        without per-runtime copies.
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
              <td className="px-4 py-3 font-mono text-xs text-sky-300">&lt;project&gt;/skills/</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">Cross-client interoperability</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="px-4 py-3 font-mono text-xs">User</td>
              <td className="px-4 py-3 font-mono text-xs">~/.&lt;client&gt;/skills/</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">Client-native location</td>
            </tr>
            <tr className="bg-sky-500/5">
              <td className="px-4 py-3 font-mono text-xs">User</td>
              <td className="px-4 py-3 font-mono text-xs text-sky-300">~/skills/</td>
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
          GAD now treats <code className="rounded bg-background/60 px-1 py-0.5 text-xs">vendor/get-anything-done/skills/</code> as the authored
          source of truth. Runtime-native layouts such as <code className="rounded bg-background/60 px-1 py-0.5 text-xs">.claude/</code>, <code className="rounded bg-background/60 px-1 py-0.5 text-xs">.codex/</code>, and generated <code className="rounded bg-background/60 px-1 py-0.5 text-xs">commands/</code> are transpiled outputs, not canonical repo content. <strong className="text-foreground"><code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad install</code> now reads canonical skills first</strong> and emits the runtime-specific shape each client needs. The full findability writeup is at <a
            href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/docs/SKILL-FINDABILITY-2026-04-09.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose-100 underline decoration-dotted"
          >.planning/docs/SKILL-FINDABILITY-2026-04-09.md</a>. Standardizing authored skills under the repo-root <code className="rounded bg-background/60 px-1 py-0.5 text-xs">skills/</code> convention started in task 22-46 and is now the active framework contract.
        </p>
      </div>
      </Identified>
    </SiteSection>
  );
}
