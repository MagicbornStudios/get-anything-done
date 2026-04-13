import { ExternalLink } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Button } from "@/components/ui/button";
import { REPO } from "./detail-shell-shared";

export default function DetailShellSourceBlock({ sourcePath }: { sourcePath: string }) {
  return (
    <Identified as="DetailShellSourceBlock" className="mt-10 border-t border-border/60 pt-6">
      <Button variant="link" className="h-auto inline-flex items-center gap-2 p-0 text-sm font-semibold text-accent" asChild>
        <a href={`${REPO}/blob/main/${sourcePath}`} target="_blank" rel="noopener noreferrer">
          Source on GitHub
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </Button>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{sourcePath}</p>
    </Identified>
  );
}
