import { Github, Terminal } from "lucide-react";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export default function RunIt() {
  return (
    <section id="run" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Run it locally</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          One repo. <span className="gradient-text">One CLI.</span> Five commands to your first eval run.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          The CLI lives at <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">bin/gad.cjs</code>.
          The eval projects live under <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/</code>.
          Everything else is committed planning state. No services, no auth, no telemetry.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-border/70 bg-background/60">
          <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-5 py-3">
            <Terminal size={14} className="text-accent" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              terminal
            </span>
          </div>
          <pre className="overflow-x-auto px-6 py-5 font-mono text-sm leading-7 text-muted-foreground">
{`# 1. Clone the repo
git clone https://github.com/MagicbornStudios/get-anything-done
cd get-anything-done

# 2. See available eval projects
node bin/gad.cjs eval list

# 3. Bootstrap an agent prompt for one project
node bin/gad.cjs eval bootstrap escape-the-dungeon-bare

# 4. Run an eval (creates an isolated git worktree)
node bin/gad.cjs eval run escape-the-dungeon-bare

# 5. After the agent finishes, preserve and verify
node bin/gad.cjs eval preserve escape-the-dungeon-bare v4 --from <worktree>
node bin/gad.cjs eval verify`}
          </pre>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={REPO}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
          >
            <Github size={18} aria-hidden />
            Read the source
          </a>
          <a
            href={`${REPO}/tree/main/evals`}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Browse the eval projects
          </a>
          <a
            href={`${REPO}/blob/main/evals/EXPERIMENT-LOG.md`}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Experiment log
          </a>
        </div>
      </div>
    </section>
  );
}
