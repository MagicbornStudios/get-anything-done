import { Sparkles, X, Copy, Check, ExternalLink } from "lucide-react";
import { REPO } from "./skill-lineage-shared";
import type { SkillArtifact } from "./skill-lineage-shared";

export default function SkillLineageSkillModal({
  skill,
  runKey,
  copied,
  onCopy,
  onClose,
}: {
  skill: SkillArtifact;
  runKey: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-card shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-amber-500/5 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-amber-300">
              <Sparkles size={10} className="mr-1 inline" aria-hidden />
              Skill · {runKey}
            </p>
            <h3 className="mt-1 truncate font-mono text-lg font-semibold text-foreground">
              {skill.name}
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
              {(skill.bytes / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
            {skill.file && (
              <a
                href={`${REPO}/blob/main/${skill.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                GitHub
                <ExternalLink size={10} aria-hidden />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              aria-label="Close"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-background/60 p-6">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground">
            {skill.content ?? "(skill file content unavailable)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
