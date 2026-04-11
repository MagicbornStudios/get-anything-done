/**
 * IA refactor (decision gad-76 / ASSUMPTIONS.md): 14 flat nav items were
 * breaking on mobile and confusing on desktop. Grouped into five dropdowns
 * plus top-level Emergent + GitHub. Primary user is the researcher (target A),
 * secondary is the indie dev (target C); nav prioritizes scanning clarity.
 */

export type NavLink = { href: string; label: string; note?: string; tint?: string };

export type NavGroup = { label: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Theory",
    links: [
      { href: "/gad", label: "GAD", note: "what the framework is" },
      { href: "/lineage", label: "Lineage", note: "GSD → RepoPlanner → GAD" },
      { href: "/methodology", label: "Methodology", note: "rubric, gates, rounds" },
      { href: "/hypotheses", label: "Hypotheses", note: "every claim wired to its eval track" },
      { href: "/skeptic", label: "Skeptic", note: "devils advocate against our claims" },
      { href: "/standards", label: "Standards", note: "Anthropic guide + agentskills.io" },
      { href: "/glossary", label: "Glossary", note: "every domain term" },
    ],
  },
  {
    label: "Evaluation",
    links: [
      { href: "/findings", label: "Findings", note: "per-round writeups" },
      { href: "/rubric", label: "Rubric", note: "how we score" },
      { href: "/#results", label: "Round results", note: "per-round scored runs" },
      { href: "/#graphs", label: "Graphs", note: "quality + pressure scatters" },
      { href: "/decisions", label: "Decisions", note: "DECISIONS.xml rendered" },
      { href: "/questions", label: "Questions", note: "open research questions" },
      { href: "/roadmap", label: "Roadmap", note: "round timeline" },
      { href: "/data", label: "Data provenance", note: "every number's source" },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/skills", label: "Skills", note: "every authored skill + provenance" },
      { href: "/#catalog", label: "Agents", note: "subagents" },
      { href: "/#catalog", label: "Commands", note: "gad CLI" },
      { href: "/#catalog", label: "Templates", note: "eval starting points" },
    ],
  },
  {
    label: "Play",
    links: [
      { href: "/#play", label: "Playable Archive", note: "play every scored build" },
      { href: "/videos", label: "Videos", note: "walkthroughs" },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/planning", label: "Planning", note: "in-repo state + tasks" },
      { href: "/tasks", label: "Tasks", note: "every task in TASK-REGISTRY" },
      { href: "/phases", label: "Phases", note: "ROADMAP.xml rendered" },
      { href: "/bugs", label: "Bugs", note: "tracked across runs" },
      { href: "/requirements", label: "Requirements", note: "v5 + history" },
      { href: "/security", label: "Security", note: "skill risks + certification" },
      { href: "/contribute", label: "Contribute", note: "clone and run your own" },
      { href: "/feature-requests", label: "Feature Requests", note: "what we need from others" },
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
