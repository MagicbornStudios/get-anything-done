import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RUN_IT_EVALS_TREE_URL,
  RUN_IT_EXPERIMENT_LOG_URL,
  RUN_IT_REPO,
} from "@/components/landing/run-it/run-it-shared";

export function RunItCtas() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button
        size="lg"
        className="gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5 hover:bg-accent/90"
        asChild
      >
        <a href={RUN_IT_REPO} rel="noopener noreferrer" target="_blank">
          <Github size={18} aria-hidden />
          Read the source
        </a>
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
        asChild
      >
        <a href={RUN_IT_EVALS_TREE_URL} rel="noopener noreferrer" target="_blank">
          Browse the eval projects
        </a>
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="gap-2 rounded-full border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
        asChild
      >
        <a href={RUN_IT_EXPERIMENT_LOG_URL} rel="noopener noreferrer" target="_blank">
          Experiment log
        </a>
      </Button>
    </div>
  );
}
