import { Github } from "lucide-react";
import {
  RUN_IT_EVALS_TREE_URL,
  RUN_IT_EXPERIMENT_LOG_URL,
  RUN_IT_REPO,
} from "@/components/landing/run-it/run-it-shared";

export function RunItCtas() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href={RUN_IT_REPO}
        rel="noopener noreferrer"
        target="_blank"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
      >
        <Github size={18} aria-hidden />
        Read the source
      </a>
      <a
        href={RUN_IT_EVALS_TREE_URL}
        rel="noopener noreferrer"
        target="_blank"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        Browse the eval projects
      </a>
      <a
        href={RUN_IT_EXPERIMENT_LOG_URL}
        rel="noopener noreferrer"
        target="_blank"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        Experiment log
      </a>
    </div>
  );
}
