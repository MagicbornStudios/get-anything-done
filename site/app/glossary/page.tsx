import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { GLOSSARY, GLOSSARY_UPDATED, type GlossaryTerm } from "@/lib/eval-data";

export const metadata = {
  title: "Glossary — GAD",
  description:
    "Every domain term used on this site. Compound-Skills Hypothesis, freedom hypothesis, emergent workflow, gate criterion, rubric, trace schema v4, and more.",
};

const CATEGORY_TINT: Record<string, string> = {
  hypothesis: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  workflow: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  evaluation: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  framework: "bg-purple-500/15 text-purple-300 border-purple-500/40",
  "game-design": "bg-pink-500/15 text-pink-300 border-pink-500/40",
  process: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  infra: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

const CATEGORY_ORDER = [
  "hypothesis",
  "workflow",
  "evaluation",
  "framework",
  "game-design",
  "process",
  "infra",
];

function groupByCategory(terms: GlossaryTerm[]) {
  const groups: Record<string, GlossaryTerm[]> = {};
  for (const t of terms) {
    (groups[t.category] ??= []).push(t);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.term.localeCompare(b.term));
  }
  return groups;
}

function renderMarkdownInline(text: string): React.ReactNode {
  // Minimal markdown: **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-card/60 px-1 py-0.5 text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderFullDefinition(text: string): React.ReactNode {
  // Split on double-newlines into paragraphs.
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((p, i) => (
    <p key={i} className="mt-3 text-sm leading-7 text-muted-foreground first:mt-0">
      {renderMarkdownInline(p)}
    </p>
  ));
}

export default function GlossaryPage() {
  const grouped = groupByCategory(GLOSSARY);
  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped[c]?.length > 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Glossary</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Every term, one place.{" "}
            <span className="gradient-text">No more googling our jargon.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            We use a lot of project-specific language — CSH, freedom hypothesis, gate
            criterion, rubric, trace schema v4, emergent workflow. This page is the
            authoritative definition for every term, grouped by category. Any underlined
            dotted term elsewhere on the site links back here.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Source:{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">
              data/glossary.json
            </code>
            {GLOSSARY_UPDATED && (
              <>
                {" · last updated "}
                <span className="tabular-nums">{GLOSSARY_UPDATED}</span>
              </>
            )}
            {" · "}
            <Link href="/questions" className="text-accent underline decoration-dotted">
              see open questions
            </Link>
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {GLOSSARY.length}
              </span>{" "}
              terms
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {orderedCategories.length}
              </span>{" "}
              categories
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            {orderedCategories.map((cat) => (
              <a
                key={cat}
                href={`#category-${cat}`}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors hover:brightness-125 ${
                  CATEGORY_TINT[cat] ?? "border-border/60 text-muted-foreground"
                }`}
              >
                {cat.replace("-", " ")} ({grouped[cat].length})
              </a>
            ))}
          </nav>
        </div>
      </section>

      {orderedCategories.map((cat) => (
        <section
          key={cat}
          id={`category-${cat}`}
          className="border-b border-border/60 bg-card/20 last:bg-background last:border-b-0"
        >
          <div className="section-shell">
            <div className="mb-6 flex items-center gap-3">
              <BookOpen size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0 capitalize">{cat.replace("-", " ")}</p>
              <Badge variant="outline">{grouped[cat].length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {grouped[cat].map((t) => (
                <Card key={t.id} id={t.id} className="scroll-mt-24">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg leading-tight">{t.term}</CardTitle>
                    {t.aliases.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        aliases:
                        {t.aliases.map((a) => (
                          <code
                            key={a}
                            className="rounded bg-background/60 px-1 py-0.5 font-mono"
                          >
                            {a}
                          </code>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="mb-3 border-l-2 border-accent/60 pl-3 text-sm italic leading-6 text-foreground/90">
                      {t.short}
                    </p>
                    <div>{renderFullDefinition(t.full)}</div>
                    {(t.related_decisions.length > 0 ||
                      t.related_terms.length > 0) && (
                      <div className="mt-4 space-y-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                        {t.related_decisions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="uppercase tracking-wider text-[10px]">decisions:</span>
                            {t.related_decisions.map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px]"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.related_terms.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="uppercase tracking-wider text-[10px]">see also:</span>
                            {t.related_terms.map((rt) => (
                              <a
                                key={rt}
                                href={`#${rt}`}
                                className="inline-flex items-center gap-0.5 rounded border border-accent/40 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/10"
                              >
                                {rt}
                                <ArrowRight size={9} aria-hidden />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      {GLOSSARY.length === 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="text-muted-foreground">
              No glossary terms yet. Add entries to{" "}
              <code>data/glossary.json</code> and re-run prebuild.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
