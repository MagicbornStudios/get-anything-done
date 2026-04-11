import Link from "next/link";
import { Github, Download, Gauge, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseAddendum,
  parseV4Base,
  PROJECT_LABELS,
  REPO,
  type CurrentRequirementFile,
} from "@/app/requirements/requirements-shared";

export function RequirementsProjectSection({
  project,
  file,
}: {
  project: string;
  file: CurrentRequirementFile;
}) {
  const xml = file.content as string;
  const v4Base = parseV4Base(xml);
  const addendum = parseAddendum(xml);

  return (
    <section id={project} className="border-b border-border/60 bg-card/20">
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

        {v4Base.goal && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                v4 base — goal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-foreground/90">{v4Base.goal}</CardContent>
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

        {addendum.length > 0 && (
          <div className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <Gauge size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0">
                v5 addendum — {addendum.length} playtest-driven additions
              </p>
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
                        <CardTitle className="text-base leading-tight">{req.title}</CardTitle>
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
}
