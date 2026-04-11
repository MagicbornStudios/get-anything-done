import { Sparkles, ExternalLink } from "lucide-react";
import type { SkillArtifact } from "./skill-lineage-shared";

export default function SkillLineageSkillBody({
  skills,
  onSelectSkill,
}: {
  skills: SkillArtifact[];
  onSelectSkill: (skill: SkillArtifact) => void;
}) {
  const hasContent = skills.length > 0;

  if (!hasContent) {
    return (
      <p className="mt-5 text-xs text-muted-foreground opacity-70">
        No preserved skill artifacts for this run.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Skills authored or carried forward this run — click to read
      </p>
      <ul className="space-y-1">
        {skills.map((s) => (
          <li key={s.name}>
            <button
              type="button"
              onClick={() => onSelectSkill(s)}
              disabled={!s.content}
              className="flex w-full items-center justify-between gap-3 rounded border border-border/40 bg-background/40 px-3 py-2 text-left font-mono text-xs text-muted-foreground transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-200 disabled:opacity-60 disabled:hover:border-border/40 disabled:hover:bg-background/40 disabled:hover:text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={10} className="text-amber-400" aria-hidden />
                {s.name}
              </span>
              <span className="flex items-center gap-2 text-[10px] opacity-60 tabular-nums">
                {(s.bytes / 1024).toFixed(1)} KB
                {s.content && (
                  <ExternalLink size={9} className="opacity-80" aria-hidden />
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
