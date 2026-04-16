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
    ],
  },
  {
    label: "Play",
    links: [
      { href: "/library", label: "Library", note: "play all published generation builds" },
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
          {
            href: "/data",
            label: "Local DB",
            note: "generated site data index + field lineage (same catalog `gad data` targets)",
          },
        ],
      },
      {
        label: "Catalog",
        links: [
          { href: "/context-frameworks", label: "Context frameworks", note: "bare / GSD / GAD bundles" },
          { href: "/downloads", label: "Downloads", note: "eval templates + planning packs" },
        ],
      },
      {
        label: "Reference",
        links: [
          { href: "/roadmap", label: "Evidence", note: "round-by-round outcomes and pressure history" },
          { href: "/standards", label: "Standards", note: "Anthropic guide + agentskills.io" },
          { href: "/roadmap", label: "Roadmap", note: "phases, rounds, and pressure progression" },
        ],
      },
      {
        label: "Engage",
        links: [
          { href: "/security", label: "Security", note: "skill risks + certification" },
          { href: "/contribute", label: "Contribute", note: "clone and run your own" },
          { href: "/contribute", label: "Contribute", note: "how to help and where to start" },
        ],
      },
    ],
  },
];

export const NAV_TOP_LEVEL: NavLink[] = [];

export const NAV_GITHUB_HREF = "https://github.com/MagicbornStudios/get-anything-done";



