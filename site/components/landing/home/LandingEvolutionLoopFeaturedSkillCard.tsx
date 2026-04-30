import Link from "next/link";
import { Download } from "lucide-react";
import { Identified } from "gad-visual-context";
import { SKILLS, GITHUB_REPO } from "@/lib/catalog.generated";

const GITHUB_RAW_PREFIX = `${GITHUB_REPO}/blob/main/`;
const GITHUB_DOWNLOAD_PREFIX =
  GITHUB_REPO.replace("github.com", "raw.githubusercontent.com") + "/main/";

function skillPreviewLines(bodyRaw: string): string[] {
  const stripped = bodyRaw
    .replace(/^\s+/, "")
    .split("\n")
    .filter((line) => !/^---/.test(line));
  const out: string[] = [];
  for (const line of stripped) {
    out.push(line);
    if (out.length >= 14) break;
  }
  return out;
}

/**
 * Preview tile for a single real `SKILL.md` from the repo. Renders file
 * path + frontmatter-stripped head, with "View on GitHub" and a direct
 * raw-file Download. `Identified as="LandingEvolutionLoopFeaturedSkill-<id>"`
 * gives each tile its own dev-id so an agent can be told "fix this card"
 * without ambiguity.
 */
export function LandingEvolutionLoopFeaturedSkillCard({
  skillId,
}: {
  skillId: string;
}) {
  const skill = SKILLS.find((s) => s.id === skillId);
  if (!skill) return null;

  const filePath = skill.file.replace(/^vendor\/get-anything-done\//, "");
  const rawPath = skill.file.replace(/^vendor\/get-anything-done\//, "");
  const viewHref = `${GITHUB_RAW_PREFIX}${rawPath}`;
  const downloadHref = `${GITHUB_DOWNLOAD_PREFIX}${rawPath}`;
  const previewLines = skillPreviewLines(skill.bodyRaw);

  return (
    <Identified
      as={`LandingEvolutionLoopFeaturedSkill-${skill.id}`}
      className="flex min-w-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-muted/15 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-accent/70" aria-hidden />
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {filePath}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border/50 bg-background/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            SKILL.md
          </span>
        </div>

        <div className="flex min-h-[11rem] flex-1 flex-col gap-3 border-b border-border/40 bg-background/40 px-4 py-3">
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">
              {skill.name}
            </p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {skill.description}
            </p>
          </div>
          <pre className="mt-auto overflow-hidden rounded-md border border-border/50 bg-background/70 px-3 py-2 font-mono text-[11px] leading-snug text-foreground/85">
            {previewLines.join("\n")}
            {"\n…"}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
          <Link
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            View on GitHub
          </Link>
          <a
            href={downloadHref}
            download
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            <Download size={12} aria-hidden />
            Download
          </a>
        </div>
      </div>
    </Identified>
  );
}
