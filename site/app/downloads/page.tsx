export const dynamic = "force-dynamic";
import { Terminal, Package, LayoutGrid, Braces, Layers, PanelTop, Search, Keyboard, Eye, Box } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { MarketingShell, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import Templates from "@/components/landing/templates/Templates";

export const metadata = {
  title: "Downloads — GAD",
  description:
    "Installer, CLI reference, VCS component registry, and species templates — everything you need to run GAD.",
};

const CLI_COMMANDS = [
  { command: "gad snapshot", purpose: "Full project context in one command" },
  { command: "gad projects list", purpose: "Show all registered projects" },
  { command: "gad projects sync", purpose: "Auto-discover planning roots" },
  { command: "gad tasks", purpose: "View task registry" },
  { command: "gad phases", purpose: "View roadmap phases" },
  { command: "gad decisions", purpose: "View decision log" },
  { command: "gad species run <name>", purpose: "Launch a new generation from a species" },
  { command: "gad generation preserve", purpose: "Save generation artifacts" },
] as const;

const VCS_COMPONENTS = [
  {
    name: "<Identified>",
    icon: Eye,
    description: "Wraps any element with a stable data-cid for agent targeting",
  },
  {
    name: "<SiteSection>",
    icon: Layers,
    description: "Page section with automatic CID registration",
  },
  {
    name: "<BandDevPanel>",
    icon: PanelTop,
    description: "Floating dev panel for inspecting/editing a section",
  },
  {
    name: "<DevPanel>",
    icon: LayoutGrid,
    description: "Full development overlay with screenshot, prompt, and context tools",
  },
  {
    name: "<SectionRegistry>",
    icon: Box,
    description: "Registry listing all identified sections on the current page",
  },
  {
    name: "<DevIdSearchDialog>",
    icon: Search,
    description: "Search across all CIDs on the page",
  },
  {
    name: "<DevIdModalContextFooter>",
    icon: Braces,
    description: "Context footer injected into every modal for agent handoff",
  },
  {
    name: "<KeyboardShortcutsProvider>",
    icon: Keyboard,
    description: "Ctrl+arrow navigation, speech recognition, chord modifiers",
  },
] as const;

export default function DownloadsPage() {
  return (
    <MarketingShell>
      {/* ── Section 1: Installer & CLI ── */}
      <SiteSection cid="downloads-installer-cli-site-section">
        <Identified as="DownloadsInstallerCli">
          <SiteSectionHeading
            kicker="Installer & CLI"
            as="h1"
            preset="hero"
            title="Get Started"
          />
          <SiteProse className="mt-6">
            One command bootstraps the full planning structure, skill catalog, and CLI into any
            repo. Works with Claude Code, Cursor, Windsurf, Cline, Aider, Codex CLI, and any
            coding agent that reads markdown.
          </SiteProse>

          <pre className="mt-8 bg-card/60 rounded-lg border border-border p-4 font-mono text-sm overflow-x-auto">
            <code>
              <span className="text-muted-foreground select-none">$ </span>
              <span className="text-foreground">npx gad init</span>
            </code>
          </pre>

          <div className="mt-10">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Terminal size={18} className="text-muted-foreground" />
              CLI Quick Reference
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card/40">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                      Command
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CLI_COMMANDS.map((row) => (
                    <tr key={row.command} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5">
                        <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs font-mono">
                          {row.command}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Identified>
      </SiteSection>

      {/* ── Section 2: VCS Component Registry ── */}
      <SiteSection cid="downloads-vcs-components-site-section" tone="muted">
        <Identified as="DownloadsVcsComponents">
          <SiteSectionHeading
            kicker="Component Registry"
            as="h2"
            preset="hero"
            title="Visual Context System"
          />
          <SiteProse className="mt-6">
            React components that make every UI element agent-addressable. Each component registers
            a deterministic <code className="rounded bg-card/60 px-1 py-0.5 text-sm">data-cid</code>{" "}
            so agents can target, inspect, and modify any section of your interface by name.
          </SiteProse>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {VCS_COMPONENTS.map((comp) => {
              const Icon = comp.icon;
              return (
                <div
                  key={comp.name}
                  className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="shrink-0 text-muted-foreground" />
                    <code className="text-sm font-semibold text-foreground">{comp.name}</code>
                    <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                      coming soon
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {comp.description}
                  </p>
                </div>
              );
            })}
          </div>

          <SiteProse size="sm" className="mt-8">
            VCS components ship with the GAD skill file{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">
              gad-visual-context-system/SKILL.md
            </code>{" "}
            that teaches agents how to instrument any React app.
          </SiteProse>
        </Identified>
      </SiteSection>

      {/* ── Section 3: Species Templates ── */}
      <Templates />
    </MarketingShell>
  );
}
