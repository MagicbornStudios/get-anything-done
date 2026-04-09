import Link from "next/link";
import { HelpCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { Term } from "@/components/glossary/Term";
import {
  OPEN_QUESTIONS,
  OPEN_QUESTIONS_UPDATED,
  type OpenQuestion,
} from "@/lib/eval-data";

export const metadata = {
  title: "Open questions — GAD",
  description:
    "The unresolved questions about the project, hypothesis, evaluation approach, and framework. Public backlog of what is still being worked out.",
};

const CATEGORY_TINT: Record<string, string> = {
  hypothesis: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  evaluation: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  site: "bg-purple-500/15 text-purple-300 border-purple-500/40",
  framework: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  tooling: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  "game-design": "bg-pink-500/15 text-pink-300 border-pink-500/40",
};

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_TINT: Record<string, "success" | "default" | "outline"> = {
  open: "default",
  discussing: "outline",
  resolved: "success",
};

function groupByCategory(questions: OpenQuestion[]) {
  const groups: Record<string, OpenQuestion[]> = {};
  for (const q of questions) {
    (groups[q.category] ??= []).push(q);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    );
  }
  return groups;
}

export default function QuestionsPage() {
  const open = OPEN_QUESTIONS.filter((q) => q.status !== "resolved");
  const resolved = OPEN_QUESTIONS.filter((q) => q.status === "resolved");
  const grouped = groupByCategory(open);
  const categories = Object.keys(grouped).sort();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Open questions</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            What we&apos;re still working out.{" "}
            <span className="gradient-text">In public.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            GAD is a research framework. A lot of what we publish is provisional — the{" "}
            <Term id="compound-skills-hypothesis">hypotheses</Term> are hypotheses, the{" "}
            <Term id="rubric">rubric</Term> is v1, the site is mid-refactor. Instead of
            hiding the rough edges, this page lists every unresolved question we&apos;re
            currently sitting with, grouped by category and ranked by priority. When a
            question is resolved, it stays on the page with the resolution attached.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Unfamiliar terms are underlined with a dotted line — hover for a short
            definition, click to jump to the{" "}
            <Link href="/glossary" className="text-accent underline decoration-dotted">
              full glossary
            </Link>
            .
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Source:{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">
              data/open-questions.json
            </code>{" "}
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
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {open.length}
              </span>{" "}
              open
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {resolved.length}
              </span>{" "}
              resolved
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {categories.length}
              </span>{" "}
              categories
            </div>
          </div>
        </div>
      </section>

      {categories.map((cat) => (
        <section
          key={cat}
          id={cat}
          className="border-b border-border/60 bg-card/20 last:bg-background last:border-b-0"
        >
          <div className="section-shell">
            <div className="mb-6 flex items-center gap-3">
              <HelpCircle size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0 capitalize">{cat.replace("-", " ")}</p>
              <Badge variant="outline">{grouped[cat].length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {grouped[cat].map((q) => (
                <Card key={q.id}>
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          CATEGORY_TINT[q.category] ?? "border-border/60 text-muted-foreground"
                        }`}
                      >
                        {q.priority}
                      </span>
                      <Badge variant={STATUS_TINT[q.status] ?? "outline"}>{q.status}</Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {q.opened_on}
                      </span>
                    </div>
                    <CardTitle className="text-base leading-tight">{q.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm leading-6 text-muted-foreground">{q.context}</p>
                    {(q.related_decisions.length > 0 ||
                      q.related_requirements.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {q.related_decisions.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {d}
                          </span>
                        ))}
                        {q.related_requirements.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded border border-accent/40 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      {resolved.length > 0 && (
        <section className="border-t border-border/60">
          <div className="section-shell">
            <p className="section-kicker">Resolved</p>
            <h2 className="text-2xl font-semibold tracking-tight">What used to be open</h2>
            <div className="mt-6 space-y-3">
              {resolved.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-border/60 bg-card/20 p-4"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="success">resolved</Badge>
                    <span>{q.resolved_on}</span>
                  </div>
                  <p className="font-medium text-foreground">{q.title}</p>
                  {q.resolution && (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {q.resolution}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {OPEN_QUESTIONS.length === 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="text-muted-foreground">
              No open questions yet. Add entries to{" "}
              <code>data/open-questions.json</code> and re-run prebuild.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
