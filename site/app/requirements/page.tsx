import Link from "next/link";
import { FileText, Github, Download, Gauge, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { CURRENT_REQUIREMENTS, REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";

export const metadata = {
  title: "Requirements — GAD",
  description:
    "Every eval project's current REQUIREMENTS.xml, version history, and the v5 addendum requirements as addressable anchors. Pressure is a first-class axis (decision gad-75).",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

interface ParsedRequirement {
  id: string;
  title: string;
  amends?: string;
  body: string;
}

/**
 * Extract structured <requirement id="R-v5.XX"> elements from an addendum XML block.
 * Returns empty array if no addendum is present.
 */
function parseAddendum(xml: string): ParsedRequirement[] {
  const addendumMatch = xml.match(/<addendum\s+version="[^"]+"[^>]*>([\s\S]*?)<\/addendum>/);
  if (!addendumMatch) return [];
  const inner = addendumMatch[1];
  const reqRegex = /<requirement\s+id="([^"]+)"(?:\s+amends="([^"]+)")?\s+title="([^"]+)"[^>]*>([\s\S]*?)<\/requirement>/g;
  const out: ParsedRequirement[] = [];
  let m;
  while ((m = reqRegex.exec(inner)) !== null) {
    const body = m[4]
      .trim()
      .replace(/\s+/g, " ")
      .trim();
    out.push({
      id: m[1],
      amends: m[2],
      title: m[3],
      body,
    });
  }
  return out;
}

/**
 * Extract the <goal>, <core-principle>, and <gate-criteria> summaries from the v4 base.
 */
function parseV4Base(xml: string) {
  const goal = (xml.match(/<goal>([\s\S]*?)<\/goal>/) || [])[1]?.trim() ?? null;
  const corePrinciple = (xml.match(/<core-principle>([\s\S]*?)<\/core-principle>/) || [])[1]?.trim() ?? null;
  const gateRegex = /<gate\s+id="(G\d)"\s+name="([^"]+)">([\s\S]*?)<\/gate>/g;
  const gates: Array<{ id: string; name: string; summary: string }> = [];
  let m;
  while ((m = gateRegex.exec(xml)) !== null) {
    const summary = m[3].trim().replace(/\s+/g, " ").slice(0, 400);
    gates.push({ id: m[1], name: m[2], summary });
  }
  return { goal, corePrinciple, gates };
}

const PROJECT_LABELS: Record<string, string> = {
  "escape-the-dungeon": "Escape the Dungeon · GAD",
  "escape-the-dungeon-bare": "Escape the Dungeon · Bare",
  "escape-the-dungeon-emergent": "Escape the Dungeon · Emergent",
};

export default function RequirementsPage() {
  // Group by project so users can jump to the right one
  const byProject = new Map<string, typeof CURRENT_REQUIREMENTS>();
  for (const req of CURRENT_REQUIREMENTS) {
    const arr = byProject.get(req.project) ?? [];
    arr.push(req);
    byProject.set(req.project, arr);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Requirements</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Every spec, every version.{" "}
            <span className="gradient-text">Every R-v5.XX has a permalink.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            This page renders every greenfield escape-the-dungeon project&apos;s current{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-sm">REQUIREMENTS.xml</code>:
            the v4 pressure-oriented base plus the v5 addendum with 21 playtest-driven
            additions. Each requirement has a stable anchor so other pages can link to
            individual rules (e.g.{" "}
            <Link
              href="#R-v5.13"
              className="text-accent underline decoration-dotted"
            >
              R-v5.13
            </Link>{" "}
            for the rule-based-combat choice).
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            All three templates carry the same spec — the difference between the three
            projects is workflow (GAD / Bare / Emergent), not requirements. Full version
            history: <Link href="#history" className="text-accent underline decoration-dotted">see timeline below</Link>{" "}
            or read the{" "}
            <a
              href={`${REPO}/blob/main/evals/REQUIREMENTS-VERSIONS.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              REQUIREMENTS-VERSIONS.md narrative
            </a>{" "}
            on GitHub.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {CURRENT_REQUIREMENTS.length}
              </span>{" "}
              template files
            </div>
            <div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {REQUIREMENTS_HISTORY.length}
              </span>{" "}
              versions in history
            </div>
          </div>
        </div>
      </section>

      {[...byProject.entries()].map(([project, files]) => {
        const file = files[0]; // should be one current template per project
        if (!file?.content) {
          return (
            <section
              key={project}
              id={project}
              className="border-b border-border/60 bg-card/20"
            >
              <div className="section-shell">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {PROJECT_LABELS[project] ?? project}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  No REQUIREMENTS.xml content loaded.
                </p>
              </div>
            </section>
          );
        }

        const v4Base = parseV4Base(file.content);
        const addendum = parseAddendum(file.content);

        return (
          <section
            key={project}
            id={project}
            className="border-b border-border/60 bg-card/20"
          >
            <div className="section-shell">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="default" className="inline-flex items-center gap-1.5">
                  <Flame size={10} aria-hidden />
                  {file.version}
                </Badge>
                <Badge variant="outline">{project}</Badge>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {PROJECT_LABELS[project] ?? project}
              </h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {file.sourcePath && (
                  <a
                    href={`${REPO}/blob/main/${file.sourcePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
                  >
                    <Github size={11} aria-hidden />
                    View on GitHub
                  </a>
                )}
                <a
                  href={file.path}
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  <Download size={11} aria-hidden />
                  Download .xml
                </a>
              </div>

              {/* v4 base */}
              {v4Base.goal && (
                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                      v4 base — goal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm leading-6 text-foreground/90">
                    {v4Base.goal}
                  </CardContent>
                </Card>
              )}

              {v4Base.corePrinciple && (
                <Card className="mt-4 border-l-4 border-amber-500/60">
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-wider text-amber-300">
                      Core principle (v4)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm leading-6 text-foreground/90">
                    {v4Base.corePrinciple}
                  </CardContent>
                </Card>
              )}

              {v4Base.gates.length > 0 && (
                <div className="mt-6">
                  <p className="section-kicker">Gate criteria (v4 base)</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {v4Base.gates.map((g) => (
                      <Card key={g.id} id={`${project}-${g.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {g.id}
                            </Badge>
                            <CardTitle className="text-sm">{g.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 text-xs leading-5 text-muted-foreground">
                          {g.summary}…
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* v5 addendum */}
              {addendum.length > 0 && (
                <div className="mt-10">
                  <div className="mb-4 flex items-center gap-3">
                    <Gauge size={18} className="text-accent" aria-hidden />
                    <p className="section-kicker !mb-0">v5 addendum — {addendum.length} playtest-driven additions</p>
                  </div>
                  <div className="space-y-3">
                    {addendum.map((req) => (
                      <Card key={req.id} id={req.id} className="scroll-mt-24">
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="font-mono text-accent">
                                {req.id}
                              </Badge>
                              {req.amends && (
                                <Badge variant="outline" className="text-[10px]">
                                  amends {req.amends}
                                </Badge>
                              )}
                              <CardTitle className="text-base leading-tight">
                                {req.title}
                              </CardTitle>
                            </div>
                            <Link
                              href={`#${req.id}`}
                              className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
                            >
                              #{req.id}
                            </Link>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                          {req.body}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Version history */}
      <section id="history" className="border-b border-border/60">
        <div className="section-shell">
          <div className="mb-6 flex items-center gap-2">
            <FileText size={18} className="text-accent" aria-hidden />
            <p className="section-kicker !mb-0">Version history</p>
          </div>
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Every requirements version has its own entry. Each version defines a round
            (decision{" "}
            <Link href="/decisions#gad-72" className="text-accent underline decoration-dotted">
              gad-72
            </Link>
            ) — new requirements version = new round.
          </p>
          <div className="space-y-4">
            {REQUIREMENTS_HISTORY.slice()
              .reverse()
              .map((v) => (
                <Card key={v.version}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="font-mono">
                        {v.version}
                      </Badge>
                      <CardTitle className="text-base">{v.date}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-6 text-muted-foreground">
                      {v.rawBody}
                    </pre>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
