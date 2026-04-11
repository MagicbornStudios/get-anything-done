import { Download, FileText, GitCommit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/components/landing/requirements/requirements-shared";
import { CURRENT_REQUIREMENTS } from "@/lib/catalog.generated";

export function RequirementsDownloads() {
  return (
    <>
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
    </>
  );
}
