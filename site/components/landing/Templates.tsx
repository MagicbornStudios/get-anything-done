import { Download, FileArchive, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EVAL_TEMPLATES,
  GAD_PACK_TEMPLATE,
  PROJECT_LABELS,
} from "@/lib/eval-data";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function Templates() {
  return (
    <section id="templates" className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Downloads</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Every template we ship. <span className="gradient-text">Zip. Extract. Go.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          The GAD pack template is the full set of 34+ markdown templates the CLI uses to
          scaffold new projects — requirements, roadmap, state, task registry, phase prompts,
          debug reports, verification artifacts, codebase docs. Every eval project ships its
          own <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">template/</code>{" "}
          directory containing the minimum viable workspace an agent needs to start that eval.
        </p>

        {GAD_PACK_TEMPLATE && (
          <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
            <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:gap-8">
              <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-accent/60 bg-background/50 text-accent">
                <Package size={24} aria-hidden />
              </div>
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-semibold tracking-tight">GAD pack template</h3>
                  <Badge variant="outline">{formatBytes(GAD_PACK_TEMPLATE.bytes)}</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Drop <code className="rounded bg-card/60 px-1 py-0.5 text-xs">templates/</code>{" "}
                  into your repo, run <code className="rounded bg-card/60 px-1 py-0.5 text-xs">gad new-project</code>,
                  and you&apos;re at the same starting line as every GAD project.
                </p>
              </div>
              <a
                href={GAD_PACK_TEMPLATE.zipPath}
                download
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
              >
                <Download size={16} aria-hidden />
                Download ZIP
              </a>
            </div>
          </div>
        )}

        <h3 className="mt-16 text-2xl font-semibold tracking-tight">Eval project templates</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Each zip contains the <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">template/</code>{" "}
          directory for one eval project — REQUIREMENTS.xml, AGENTS.md, source design docs, and
          (for emergent runs) the inherited skills library. These are the starting states an
          agent sees before writing any code.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {EVAL_TEMPLATES.map((tpl) => (
            <Card key={tpl.project} className="transition-colors hover:border-accent/60">
              <CardHeader>
                <div className="mb-2 inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-accent">
                  <FileArchive size={16} aria-hidden />
                </div>
                <CardTitle className="text-base">
                  {PROJECT_LABELS[tpl.project] ?? tpl.project}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {tpl.project}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(tpl.bytes)}
                </span>
                <a
                  href={tpl.zipPath}
                  download
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <Download size={12} aria-hidden />
                  ZIP
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
