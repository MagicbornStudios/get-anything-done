import { Download, FileText, GitCommit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENT_REQUIREMENTS, REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const VERSION_GRADIENT: Record<string, string> = {
  v1: "from-red-500/20 via-red-500/5 to-transparent border-red-500/30",
  v2: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30",
  v3: "from-sky-500/20 via-sky-500/5 to-transparent border-sky-500/30",
  v4: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30",
};

export default function Requirements() {
  return (
    <section id="requirements" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Game requirements</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Four versions. <span className="gradient-text">One dungeon.</span> A lineage of what we
          thought &quot;good&quot; looked like.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          Every round rewrote the requirements after watching real agents attempt them. The
          diffs below are the honest version — here&apos;s what v1 couldn&apos;t catch, here&apos;s
          what v2 got wrong, here&apos;s what v3 was still too soft on. Download the current v4
          XML and try to build the game yourself — it&apos;s the same spec the agents run against.
        </p>

        <div className="mt-12 space-y-5">
          {REQUIREMENTS_HISTORY.map((v) => (
            <div
              key={v.version}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 md:p-8 ${
                VERSION_GRADIENT[v.version] ?? "border-border/70 from-card/40 to-transparent"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-3xl font-semibold tabular-nums">{v.version}</h3>
                    <Badge variant="outline">{v.date}</Badge>
                    {v.version === "v4" && <Badge variant="default">current</Badge>}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {v.sections.scope && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Scope</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.scope}
                    </p>
                  </div>
                )}
                {v.sections.changes_from_v1 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Changes from v1</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.changes_from_v1}
                    </p>
                  </div>
                )}
                {v.sections.changes_from_v2 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Changes from v2</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.changes_from_v2}
                    </p>
                  </div>
                )}
                {v.sections.changes_from_v3 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Changes from v3</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.changes_from_v3}
                    </p>
                  </div>
                )}
                {v.sections.core_shift_from_v3 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Core shift from v3</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.core_shift_from_v3}
                    </p>
                  </div>
                )}
                {v.sections.problems_that_emerged && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-red-400">Problems that emerged</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.problems_that_emerged}
                    </p>
                  </div>
                )}
                {v.sections.scoring_impact && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Scoring impact</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.scoring_impact}
                    </p>
                  </div>
                )}
                {v.sections.brownfield_vs_greenfield && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Brownfield vs greenfield</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.brownfield_vs_greenfield}
                    </p>
                  </div>
                )}
                {v.sections.decision_references && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-accent">Decision references</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                      {v.sections.decision_references}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <h3 className="mt-16 text-2xl font-semibold tracking-tight">
          Download and try to build it yourself
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The current v4 REQUIREMENTS.xml for each greenfield condition. Drop it into a new
          project with your agent of choice and see how you do. Submit your TRACE via PR.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CURRENT_REQUIREMENTS.map((req) => (
            <Card key={req.project} className="transition-colors hover:border-accent/60">
              <CardHeader>
                <div className="mb-2 inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-accent">
                  <FileText size={16} aria-hidden />
                </div>
                <CardTitle className="text-base">{req.project}</CardTitle>
                <CardDescription>REQUIREMENTS.xml · {req.version}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(req.bytes)}
                </span>
                <a
                  href={req.path}
                  download
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <Download size={12} aria-hidden />
                  XML
                </a>
              </CardContent>
            </Card>
          ))}
          <Card className="transition-colors hover:border-accent/60">
            <CardHeader>
              <div className="mb-2 inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-accent">
                <GitCommit size={16} aria-hidden />
              </div>
              <CardTitle className="text-base">Full version history</CardTitle>
              <CardDescription>v1 → v4 narrative</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">REQUIREMENTS-VERSIONS.md</span>
              <a
                href="/downloads/requirements/REQUIREMENTS-VERSIONS.md"
                download
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <Download size={12} aria-hidden />
                MD
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
