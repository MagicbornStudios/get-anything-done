import Link from "next/link";
import { Gavel, Github, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { ALL_DECISIONS, type DecisionRecord } from "@/lib/eval-data";

export const metadata = {
  title: "Decisions — GAD",
  description:
    "Every decision captured in .planning/DECISIONS.xml — hypothesis framings, framework rules, evaluation policies. Every decision has a stable anchor so other pages can link straight to it.",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";
const DECISIONS_FILE_URL = `${REPO}/blob/main/.planning/DECISIONS.xml`;

function decisionGithubAnchor(id: string): string {
  // Point to the file + query for the id; GitHub will highlight the matching
  // line on render if the user's browser supports it. Without a stable line
  // number, file-level is the most we can promise.
  return `${DECISIONS_FILE_URL}#:~:text=${encodeURIComponent(`id="${id}"`)}`;
}

function renderMarkdownInline(text: string): React.ReactNode {
  // Minimal markdown rendering: **bold**, `code`, and [link](url)
  // plus naive paragraph breaking on double newline.
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((p, idx) => {
    const parts = p.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
    return (
      <p key={idx} className="mt-3 text-sm leading-7 text-muted-foreground first:mt-0">
        {parts.map((part, i) => {
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
          const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkMatch) {
            return (
              <a key={i} href={linkMatch[2]} className="text-accent underline decoration-dotted">
                {linkMatch[1]}
              </a>
            );
          }
          return part;
        })}
      </p>
    );
  });
}

function tintForDecision(id: string): string {
  // Simple deterministic tint per numeric suffix, so higher-numbered (newer)
  // decisions stand out with warmer accents.
  const n = parseInt((id.match(/(\d+)/) || [])[1] || "0", 10);
  if (n >= 70) return "border-amber-500/40";
  if (n >= 60) return "border-emerald-500/40";
  if (n >= 40) return "border-sky-500/40";
  if (n >= 20) return "border-purple-500/40";
  return "border-border/60";
}

export default function DecisionsPage() {
  const decisions = ALL_DECISIONS;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Decisions</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Every decision, with a permalink.{" "}
            <span className="gradient-text">The load-bearing ones.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            This page renders every entry in{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">.planning/DECISIONS.xml</code>
            . Hypothesis framings, framework rules, evaluation policies, preservation
            contracts — the stuff the project has committed to, one card per decision with a
            stable anchor. Any page that references <code>gad-68</code> links here.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Newest first.{" "}
            <a
              href={DECISIONS_FILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              Source: DECISIONS.xml on GitHub
            </a>
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {decisions.length}
              </span>{" "}
              total decisions
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="mb-8 flex items-center gap-3">
            <Gavel size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">All decisions</p>
          </div>
          <div className="space-y-4">
            {decisions.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        </div>
      </section>

      {decisions.length === 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="text-muted-foreground">
              No decisions parsed. Check that <code>.planning/DECISIONS.xml</code> exists
              and re-run the prebuild.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}

function DecisionCard({ decision }: { decision: DecisionRecord }) {
  const tint = tintForDecision(decision.id);
  return (
    <Card id={decision.id} className={`scroll-mt-24 border-l-4 ${tint}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {decision.id}
            </Badge>
            <CardTitle className="text-lg leading-tight">{decision.title}</CardTitle>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`#${decision.id}`}
              title="Copy anchor link"
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              #{decision.id}
            </Link>
            <a
              href={decisionGithubAnchor(decision.id)}
              target="_blank"
              rel="noopener noreferrer"
              title="View in DECISIONS.xml on GitHub"
              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Github size={10} aria-hidden />
              GitHub
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {decision.summary && (
          <div>{renderMarkdownInline(decision.summary)}</div>
        )}
        {decision.impact && (
          <div className="mt-4 border-t border-border/40 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Impact
            </p>
            <div>{renderMarkdownInline(decision.impact)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
