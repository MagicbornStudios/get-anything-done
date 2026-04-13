/**
 * IA refactor (decision gad-76 / ASSUMPTIONS.md): 14 flat nav items were
 * breaking on mobile and confusing on desktop. Grouped into dropdowns
 * plus top-level Emergent + GitHub.
 *
 * Phase 42 update: the System group got too heavy (11 items). It now
 * supports nested subgroups via DropdownMenuSub, so System has four
 * subcategories: Internals / Catalog / Reference / Engage.
 */

export type NavLink = { href: string; label: string; note?: string; tint?: string };

export type NavSubGroup = { label: string; links: NavLink[] };

/**
 * A NavGroup may have either flat `links` or nested `subGroups` (not both).
 * NavDesktop renders flat groups as a single dropdown and nested groups as
 * a dropdown with submenu triggers.
 */
export type NavGroup =
  | { label: string; links: NavLink[]; subGroups?: undefined }
  | { label: string; links?: undefined; subGroups: NavSubGroup[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Theory",
    links: [
      { href: "/gad", label: "GAD", note: "what the framework is" },
      { href: "/hypotheses", label: "Hypotheses", note: "every claim wired to its eval track" },
      { href: "/skeptic", label: "Skeptic", note: "devils advocate against our claims" },
    ],
  },
  {
    label: "Evaluation",
    links: [
      { href: "/methodology", label: "Methodology", note: "rubric, gates, rounds, open questions, CLI" },
      { href: "/#graphs", label: "Graphs", note: "quality + pressure scatters" },
      { href: "/data", label: "Data provenance", note: "every number's source" },
    ],
  },
  {
    label: "Play",
    links: [
      { href: "/project-market", label: "Project Market", note: "browse all eval projects + playable builds" },
      { href: "/videos", label: "Videos", note: "walkthroughs" },
    ],
  },
  {
    label: "System",
    subGroups: [
      {
        label: "Internals",
        links: [
          { href: "/planning", label: "Planning", note: "state, tasks, phases, decisions, candidates, proto-skills" },
          { href: "/requirements", label: "Requirements", note: "v5 + history" },
        ],
      },
      {
        label: "Catalog",
        links: [
          { href: "/skills", label: "Skills", note: "every authored skill + provenance" },
          { href: "/#catalog", label: "Agents", note: "subagents" },
          { href: "/#catalog", label: "Commands", note: "gad CLI" },
          { href: "/downloads", label: "Downloads", note: "eval templates + planning packs" },
        ],
      },
      {
        label: "Reference",
        links: [
          { href: "/lineage", label: "Lineage", note: "GSD → RepoPlanner → GAD" },
          { href: "/standards", label: "Standards", note: "Anthropic guide + agentskills.io" },
          { href: "/findings", label: "Findings", note: "experiment writeups + framework-level lessons" },
        ],
      },
      {
        label: "Engage",
        links: [
          { href: "/security", label: "Security", note: "skill risks + certification" },
          { href: "/contribute", label: "Contribute", note: "clone and run your own" },
          { href: "/feature-requests", label: "Feature Requests", note: "what we need from others" },
        ],
      },
    ],
  },
];

export const NAV_TOP_LEVEL: NavLink[] = [
  {
    href: "/emergent",
    label: "Emergent",
    tint: "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400 hover:bg-amber-500/20",
  },
  {
    href: "/skeptic",
    label: "Skeptic",
    tint: "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:bg-rose-500/20",
  },
];

export const NAV_GITHUB_HREF = "https://github.com/MagicbornStudios/get-anything-done";
