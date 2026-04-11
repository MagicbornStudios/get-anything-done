import { ExternalLink } from "lucide-react";
import { REPO } from "./detail-shell-shared";

export default function DetailShellSourceBlock({ sourcePath }: { sourcePath: string }) {
  return (
    <div className="mt-10 border-t border-border/60 pt-6">
      <a
        href={`${REPO}/blob/main/${sourcePath}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
      >
        Source on GitHub
        <ExternalLink size={12} aria-hidden />
      </a>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{sourcePath}</p>
    </div>
  );
}
