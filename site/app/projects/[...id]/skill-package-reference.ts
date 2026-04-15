/**
 * GAD / agent skill package layout — reference shape shown next to “what this catalog row actually ships”.
 * Many skills are only `SKILL.md`; richer skills add `references/` and other peers.
 */

export type SkillRefNode = {
  kind: "dir" | "file";
  name: string;
  /** Short gloss for tooltips / modal legend */
  note?: string;
  children?: SkillRefNode[];
};

/** Canonical folder shape under the framework repo (`vendor/get-anything-done/skills/<id>/…`). */
export function canonicalSkillPackageTree(skillId: string): SkillRefNode {
  return {
    kind: "dir",
    name: `skills/${skillId}/`,
    note: "Package root — matches GAD skills/ install layout",
    children: [
      {
        kind: "file",
        name: "SKILL.md",
        note: "Required — YAML frontmatter + methodology the agent reads",
      },
      {
        kind: "dir",
        name: "references/",
        note: "Optional — extra markdown pulled in by SKILL.md",
        children: [
          {
            kind: "file",
            name: "*.md",
            note: "Example naming; not every skill ships references",
          },
        ],
      },
    ],
  };
}

/** Paths we actually have in the generated catalog for this skill (usually one file). */
export function catalogSkillFilePaths(skillId: string, sourcePath: string): string[] {
  const norm = sourcePath.replace(/\\/g, "/").trim();
  if (!norm) return [`skills/${skillId}/SKILL.md`];
  return [norm];
}

export const SKILL_PACKAGE_REFERENCE_BLURB =
  "Select a file in the tree to inspect it. Bundled paths show catalog content; others show a short notice.";
