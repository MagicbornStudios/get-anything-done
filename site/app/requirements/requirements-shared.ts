import { CURRENT_REQUIREMENTS } from "@/lib/catalog.generated";

export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export interface ParsedRequirement {
  id: string;
  title: string;
  amends?: string;
  body: string;
}

export type CurrentRequirementFile = (typeof CURRENT_REQUIREMENTS)[number];

/**
 * Extract structured <requirement id="R-v5.XX"> elements from an addendum XML block.
 * Returns empty array if no addendum is present.
 */
export function parseAddendum(xml: string): ParsedRequirement[] {
  const addendumMatch = xml.match(/<addendum\s+version="[^"]+"[^>]*>([\s\S]*?)<\/addendum>/);
  if (!addendumMatch) return [];
  const inner = addendumMatch[1];
  const reqRegex = /<requirement\s+id="([^"]+)"(?:\s+amends="([^"]+)")?\s+title="([^"]+)"[^>]*>([\s\S]*?)<\/requirement>/g;
  const out: ParsedRequirement[] = [];
  let m;
  while ((m = reqRegex.exec(inner)) !== null) {
    const body = m[4]
      .trim()
      .replace(/\s+/g, " ")
      .trim();
    out.push({
      id: m[1],
      amends: m[2],
      title: m[3],
      body,
    });
  }
  return out;
}

/**
 * Extract the <goal>, <core-principle>, and <gate-criteria> summaries from the v4 base.
 */
export function parseV4Base(xml: string) {
  const goal = (xml.match(/<goal>([\s\S]*?)<\/goal>/) || [])[1]?.trim() ?? null;
  const corePrinciple =
    (xml.match(/<core-principle>([\s\S]*?)<\/core-principle>/) || [])[1]?.trim() ?? null;
  const gateRegex = /<gate\s+id="(G\d)"\s+name="([^"]+)">([\s\S]*?)<\/gate>/g;
  const gates: Array<{ id: string; name: string; summary: string }> = [];
  let m;
  while ((m = gateRegex.exec(xml)) !== null) {
    const summary = m[3].trim().replace(/\s+/g, " ").slice(0, 400);
    gates.push({ id: m[1], name: m[2], summary });
  }
  return { goal, corePrinciple, gates };
}

export const PROJECT_LABELS: Record<string, string> = {
  "escape-the-dungeon": "Escape the Dungeon · GAD",
  "escape-the-dungeon-bare": "Escape the Dungeon · Bare",
  "escape-the-dungeon-emergent": "Escape the Dungeon · Emergent",
};

export function groupRequirementsByProject(): Map<string, CurrentRequirementFile[]> {
  const byProject = new Map<string, CurrentRequirementFile[]>();
  for (const req of CURRENT_REQUIREMENTS) {
    const arr = byProject.get(req.project) ?? [];
    arr.push(req);
    byProject.set(req.project, arr);
  }
  return byProject;
}
