/**
 * Nav config — decision gad-207: collapsed from Play + System (with subgroups)
 * to Explore + Get Started (flat links). Dead routes removed.
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
    label: "Explore",
    links: [
      { href: "/library", label: "Library", note: "play published generation builds" },
      { href: "/projects", label: "Projects", note: "browse all projects" },
      { href: "/videos", label: "Videos", note: "demos and walkthroughs" },
    ],
  },
  {
    label: "Get Started",
    links: [
      { href: "/quickstart", label: "Quickstart", note: "install and spawn your first generation" },
      { href: "/how-it-works", label: "How It Works", note: "methodology, pressure, species model" },
      { href: "/downloads", label: "Downloads", note: "installer, components, species templates" },
    ],
  },
];

export const NAV_TOP_LEVEL: NavLink[] = [];
export const NAV_GITHUB_HREF = "https://github.com/MagicbornStudios/get-anything-done";
