import Link from "next/link";
import { ExternalLink, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Feature requests — GAD",
  description: "Public record of feature requests submitted to external projects that GAD depends on.",
};

// Read directly from the JSON file at build time
import featureRequestsData from "@/../data/feature-requests.json";

const STATUS_CONFIG: Record<string, { variant: "default" | "success" | "outline" | "danger"; icon: typeof Clock }> = {
  submitted: { variant: "default", icon: Clock },
  acknowledged: { variant: "outline", icon: Clock },
  "in-progress": { variant: "outline", icon: Clock },
  resolved: { variant: "success", icon: CheckCircle2 },
  "wont-fix": { variant: "danger", icon: AlertTriangle },
};

export default function FeatureRequestsPage() {
  const requests = featureRequestsData.requests;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Feature requests</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            What we need from others.{" "}
            <span className="gradient-text">Tracked in public.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            GAD depends on features from external tools — Claude Code, Codex,
            the agentskills.io ecosystem. When we hit a blocker, we submit a
            feature request and track it here so our community can see what
            we&apos;re waiting on, what workarounds exist, and how it affects
            the research.
          </p>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <div className="space-y-4">
            {requests.map((req: any) => {
              const config = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.submitted;
              const Icon = config.icon;
              return (
                <Card key={req.id} className="border-l-4 border-rose-500/40">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={config.variant} className="inline-flex items-center gap-1">
                          <Icon size={10} aria-hidden />
                          {req.status}
                        </Badge>
                        <Badge variant="outline">{req.priority}</Badge>
                        <Badge variant="outline">{req.target}</Badge>
                      </div>
                      <a
                        href={req.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
                      >
                        #{req.issue_number}
                        <ExternalLink size={9} aria-hidden />
                      </a>
                    </div>
                    <CardTitle className="mt-2 text-lg leading-tight">
                      {req.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {req.description}
                    </p>

                    {req.blocks && req.blocks.length > 0 && (
                      <div className="mt-4 rounded border border-rose-500/20 bg-rose-500/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                          Blocks
                        </p>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {req.blocks.map((b: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {req.workaround && (
                      <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                          Workaround
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {req.workaround}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Submitted: {req.submitted_on}</span>
                      {req.related_decisions?.map((d: string) => (
                        <Ref key={d} id={d} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
