import { ExternalLink, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPO } from "@/lib/run-detail-shared";
import type { EvalRunRecord } from "@/lib/eval-data";

type RunHeroActionButtonsProps = {
  run: EvalRunRecord;
  playable: string | null;
};

export function RunHeroActionButtons({ run, playable }: RunHeroActionButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      {playable && (
        <Button
          size="lg"
          className="gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
          asChild
        >
          <a href={playable} target="_blank" rel="noopener noreferrer">
            <Gamepad2 size={16} aria-hidden />
            Play this build
          </a>
        </Button>
      )}
      <Button
        variant="outline"
        size="lg"
        className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
        asChild
      >
        <a href={`${REPO}/tree/main/evals/${run.project}/${run.version}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden />
          Source on GitHub
        </a>
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
        asChild
      >
        <a
          href={`${REPO}/blob/main/evals/${run.project}/${run.version}/TRACE.json`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={14} aria-hidden />
          Raw TRACE.json
        </a>
      </Button>
    </div>
  );
}
