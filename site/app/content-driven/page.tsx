import Link from "next/link";
import { Package, ArrowRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Content-Driven Hypothesis — GAD",
  description:
    "Planned eval track: content-pack injection. Given requirements AND a pre-authored content pack extracted from prior runs, does an agent produce a more fleshed-out game? Analogous to making a movie based on a book.",
};

export default function ContentDrivenPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <SiteSection>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge
            variant="default"
            className="inline-flex items-center gap-1.5 border-pink-500/40 bg-pink-500/10 text-pink-300"
          >
            Content-driven hypothesis
          </Badge>
          <Badge variant="outline">planned — no runs yet</Badge>
        </div>
        <SiteSectionHeading
          kicker="Content-driven"
          as="h1"
          preset="hero"
          title={
            <>
              Give the agent a <span className="gradient-text">content pack</span> and see what it
              builds.
            </>
          }
        />
        <SiteProse className="mt-6">
          The content-driven hypothesis (<Ref id="gad-66" />) is a planned eval track that gives the
          agent the usual requirements <em>plus</em> a pre-authored content pack — spells, runes,
          items, NPCs, dialogue trees, encounter tables — extracted from a prior successful run. The
          research question: does the agent produce a more fleshed-out game when the authored canon
          exists to build on? User framing: &quot;analogous to making a movie based on a book.
          Derivative, but not all processes are, much like a forger might not use the exact same
          brush.&quot;
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          This track is <strong className="text-pink-300">explicitly distinct</strong> from freedom
          and CSH. Content-pack runs and greenfield runs do <strong>not</strong> share a rubric —
          they answer different questions. Comparing them on the same score would confound the
          compound-skills measurement.
        </SiteProse>

        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
            <div className="mb-2 flex items-center gap-2 text-amber-100">
              <AlertTriangle size={14} aria-hidden />
              <strong>Not yet tested</strong>
            </div>
            <p className="text-xs">
              No runs have been produced against this hypothesis yet. The eval
              project doesn&apos;t exist yet. Dependencies: (1)
              content-extraction CLI (<Ref id="gad-66" />) that pulls an
              authored canon out of a preserved run, (2) a new eval flavor
              <code className="rounded bg-amber-500/10 px-1">
                escape-the-dungeon-inherited-content
              </code>{" "}
              that consumes it, (3) a distinct rubric scoring the
              &quot;derivative coherence&quot; quality.
            </p>
          </div>
      </SiteSection>

      {/* What we would measure */}
      <SiteSection tone="muted">
        <SiteSectionHeading
          icon={Package}
          kicker="What the content-driven track would measure"
          kickerRowClassName="mb-6 gap-3"
          iconClassName="text-pink-400"
        />
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-pink-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Scope expansion</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Given the same token budget, does the agent produce a bigger
                game when the content pack already exists? More rooms, more
                encounters, deeper mechanics — measured against a
                greenfield run of the same agent with the same budget.
              </CardContent>
            </Card>
            <Card className="border-l-4 border-pink-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Integration coherence</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Does the agent weave the pre-authored content into a unified
                game, or does the inherited canon feel bolted on? Narrative
                consistency, tonal consistency, mechanical consistency — all
                human-reviewed.
              </CardContent>
            </Card>
            <Card className="border-l-4 border-pink-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">What the agent adds</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Percentage of the final game that is the agent&apos;s own
                authorship vs the inherited canon. Too low → the agent
                didn&apos;t add anything. Too high → the content pack was
                ignored. A healthy ratio is somewhere in between.
              </CardContent>
            </Card>
          </div>
      </SiteSection>

      {/* The book-to-movie analogy */}
      <SiteSection>
        <SiteSectionHeading kicker="The derivative-work framing" className="mb-6" />
        <blockquote className="max-w-3xl border-l-4 border-pink-500/60 pl-5 text-lg italic leading-8 text-foreground/90">
            &quot;This is a content-driven hypothesis, like starting out with
            some content first — much like making a game or movie based on a
            book or story. It&apos;s derivative, not all the processes are,
            much like a forger might not use the exact same brush.&quot;
          </blockquote>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            The value of derivative work is real — adaptations regularly
            outperform originals on reach and often on quality when the
            adaptation is genuinely creative. The content-driven track asks
            whether that effect shows up in agent-authored games: given
            authored canon to build on, does the agent produce something
            better than it would from scratch, or does the canon constrain
            the creativity that would otherwise emerge?
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            This is why content-pack runs <strong className="text-foreground">must
            not</strong> be scored against the same rubric as greenfield
            runs. A movie adapted from a book is not a worse movie because it
            didn&apos;t have to invent the plot — it&apos;s a different kind
            of movie with different success criteria. The rubric for this
            track will score derivative coherence, integration, and scope
            expansion, not originality.
          </p>
      </SiteSection>

      {/* Current status + next steps */}
      <SiteSection tone="muted">
        <SiteSectionHeading kicker="Current status" className="mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                <ul className="space-y-2">
                  <li>
                    <strong className="text-foreground">Content extraction CLI:</strong>{" "}
                    a new subcommand (<code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad eval extract-content</code>)
                    that walks a preserved eval run and emits a portable content
                    pack JSON.
                  </li>
                  <li>
                    <strong className="text-foreground">New eval flavor:</strong>{" "}
                    <code className="rounded bg-background/60 px-1 py-0.5 text-xs">escape-the-dungeon-inherited-content</code>{" "}
                    with a gad.json <code className="rounded bg-background/60 px-1 py-0.5 text-xs">content_pack</code>{" "}
                    field pointing at the source pack.
                  </li>
                  <li>
                    <strong className="text-foreground">Rubric construction:</strong>{" "}
                    dimensions for derivative coherence, integration, and scope
                    expansion — explicitly distinct from the freedom/CSH rubric.
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Round planning</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Content-driven runs will enter the rounds framework as a new
                track. They do <strong>not</strong> require their own
                requirements version — they inherit greenfield v5 requirements
                plus the content pack as an input. Per the rounds framework
                (<Ref id="gad-72" />), a new hypothesis can start a new round
                against any existing requirements version. Round 6 is the
                current placeholder for the first content-driven run.
              </CardContent>
            </Card>
          </div>
      </SiteSection>

      <SiteSection>
        <SiteSectionHeading kicker="Related" className="mb-4" />
        <div className="flex flex-wrap gap-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
              asChild
            >
              <Link href="/hypotheses">
                All hypotheses
                <ArrowRight size={12} aria-hidden />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
              asChild
            >
              <Link href="/freedom">
                Freedom Hypothesis
                <ArrowRight size={12} aria-hidden />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
              asChild
            >
              <Link href="/emergent">
                Compound-Skills Hypothesis
                <ArrowRight size={12} aria-hidden />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-auto gap-1 rounded-full border-border/70 bg-card/40 px-3 py-1.5 font-semibold hover:border-accent hover:text-accent [&_svg]:size-3"
              asChild
            >
              <Link href="/questions#content-pack-injection-baseline">
                Resolved open question
                <ArrowRight size={12} aria-hidden />
              </Link>
            </Button>
          </div>
      </SiteSection>

      <Footer />
    </main>
  );
}
