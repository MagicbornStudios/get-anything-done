import Link from "next/link";
import { Term } from "@/components/glossary/Term";
import { OPEN_QUESTIONS_UPDATED } from "@/lib/eval-data";

export function QuestionsHero({
  openCount,
  resolvedCount,
  categoryCount,
}: {
  openCount: number;
  resolvedCount: number;
  categoryCount: number;
}) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Open questions</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          What we&apos;re still working out. <span className="gradient-text">In public.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          GAD is a research framework. A lot of what we publish is provisional — the{" "}
          <Term id="compound-skills-hypothesis">hypotheses</Term> are hypotheses, the{" "}
          <Term id="rubric">rubric</Term> is v1, the site is mid-refactor. Instead of hiding the
          rough edges, this page lists every unresolved question we&apos;re currently sitting with,
          grouped by category and ranked by priority. When a question is resolved, it stays on
          the page with the resolution attached.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Unfamiliar terms are underlined with a dotted line — hover for a short definition, click
          to jump to the{" "}
          <Link href="/glossary" className="text-accent underline decoration-dotted">
            full glossary
          </Link>
          .
        </p>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          Source:{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-xs">data/open-questions.json</code>{" "}
          — part of the JSON pseudo-database pattern (decision{" "}
          <Link href="/#decisions" className="text-accent underline decoration-dotted">
            gad-71
          </Link>
          ). Edit the file in the repo, the prebuild picks it up, the page renders.
          {OPEN_QUESTIONS_UPDATED && (
            <>
              {" · Last updated "}
              <span className="tabular-nums">{OPEN_QUESTIONS_UPDATED}</span>
            </>
          )}
        </p>

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{openCount}</span>{" "}
            open
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {resolvedCount}
            </span>{" "}
            resolved
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {categoryCount}
            </span>{" "}
            categories
          </div>
        </div>
      </div>
    </section>
  );
}
