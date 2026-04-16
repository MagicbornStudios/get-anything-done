import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Gene-states API (task 44.5-12).
 *
 * Returns the four gene state lists for the DNA Editor:
 *   integrated  — skills/          (canonical framework skills)
 *   expressed   — .gad-try/        (temporary trial installs)
 *   mutations   — .planning/proto-skills/ (candidate mutations)
 *   shed        — (from evolution status data, if available)
 */

type GeneEntry = {
  slug: string;
  name: string;
  description: string;
  status: string;
  path: string;
  hasWorkflow: boolean;
};

function readSkillDir(dirPath: string, status: string): GeneEntry[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries: GeneEntry[] = [];
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(dirPath, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;

      // Parse frontmatter for name/description
      const content = fs.readFileSync(skillMd, "utf8");
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let name = entry.name;
      let description = "";
      if (fmMatch) {
        const fm = fmMatch[1];
        const nameMatch = fm.match(/^name:\s*(.+)$/m);
        const descMatch = fm.match(/^description:\s*(.+)$/m);
        if (nameMatch) name = nameMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
      }

      entries.push({
        slug: entry.name,
        name,
        description,
        status,
        path: path.relative(repoRoot, path.join(dirPath, entry.name)),
        hasWorkflow: false,
      });
    }
  } catch {
    // Directory read error — return empty
  }
  return entries;
}

function readProtoSkills(dirPath: string): GeneEntry[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries: GeneEntry[] = [];
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const protoDir = path.join(dirPath, entry.name);

      // Check for PROVENANCE.md to determine completion state
      const provenance = path.join(protoDir, "PROVENANCE.md");
      let status = "mutation";
      if (fs.existsSync(provenance)) {
        const content = fs.readFileSync(provenance, "utf8");
        if (content.includes("status: complete")) status = "mutation-complete";
        if (content.includes("status: promoted")) status = "promoted";
      }

      // Try to read SKILL.md for name/description
      const skillMd = path.join(protoDir, "SKILL.md");
      let name = entry.name;
      let description = "";
      if (fs.existsSync(skillMd)) {
        const content = fs.readFileSync(skillMd, "utf8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const fm = fmMatch[1];
          const nameMatch = fm.match(/^name:\s*(.+)$/m);
          const descMatch = fm.match(/^description:\s*(.+)$/m);
          if (nameMatch) name = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }
      }

      entries.push({
        slug: entry.name,
        name,
        description,
        status,
        path: path.relative(repoRoot, protoDir),
        hasWorkflow: fs.existsSync(path.join(protoDir, "workflow.md")),
      });
    }
  } catch {
    // Directory read error
  }
  return entries;
}

// Resolve repo root from site cwd
const siteDir = process.cwd();
const repoRoot = path.resolve(siteDir, "..");

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(
      JSON.stringify({ error: "Dev-only endpoint." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  const integrated = readSkillDir(path.join(repoRoot, "skills"), "integrated");

  // Check for workflow files alongside skills
  const workflowsDir = path.join(repoRoot, "workflows");
  if (fs.existsSync(workflowsDir)) {
    for (const gene of integrated) {
      const wfPath = path.join(workflowsDir, `${gene.slug}.md`);
      gene.hasWorkflow = fs.existsSync(wfPath);
    }
  }

  const expressed = readSkillDir(path.join(repoRoot, ".gad-try"), "expressed");
  const mutations = readProtoSkills(path.join(repoRoot, ".planning", "proto-skills"));
  const shed: GeneEntry[] = []; // TODO: read from evolution shed data

  return new Response(
    JSON.stringify({
      integrated: { count: integrated.length, genes: integrated },
      expressed: { count: expressed.length, genes: expressed },
      mutations: { count: mutations.length, genes: mutations },
      shed: { count: shed.length, genes: shed },
    }),
    { headers: { "content-type": "application/json" } },
  );
}
