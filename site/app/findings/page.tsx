import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { FINDINGS } from "@/lib/catalog.generated";

export const metadata = {
  title: "Findings — GAD evaluation observations",
  description:
    "Cross-round observations from the GAD eval framework — the freedom hypothesis, process-metrics-vs-reality divergence, preservation contract, and more.",
};

export default function FindingsIndexPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <SiteSection>
        <SiteSectionHeading
          kicker="Findings"
          as="h1"
          preset="hero-compact"
          titleClassName="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl"
          title={
            <>
              What we learned. <span className="gradient-text">In writing.</span> Dated and sourced.
            </>
          }
        />
        <SiteProse className="mt-5">
          Every finding starts as a markdown file in{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/FINDINGS-*.md</code>. The
          prebuild script picks them up automatically — publish a new finding by committing a new
          file. Each entry links back to the eval runs it cites.
        </SiteProse>

        {FINDINGS.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              No findings committed yet. Add <code>evals/FINDINGS-YYYY-MM-DD-slug.md</code> and redeploy.
            </p>
          ) : (
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {FINDINGS.map((f) => (
                <Card key={f.slug} className="transition-colors hover:border-accent/60">
                  <CardHeader>
                    <div className="mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-accent" aria-hidden />
                      {f.date && <Badge variant="outline">{f.date}</Badge>}
                    </div>
                    <CardTitle>{f.title}</CardTitle>
                    <CardDescription className="font-mono text-[11px]">
                      {f.file.split("/").slice(-1)[0]}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground line-clamp-4">
                      {f.summary}
                    </p>
                    <Link
                      href={`/findings/${f.slug}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                    >
                      Read full finding
                      <ArrowRight size={14} aria-hidden />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </SiteSection>
      <Footer />
    </main>
  );
}
