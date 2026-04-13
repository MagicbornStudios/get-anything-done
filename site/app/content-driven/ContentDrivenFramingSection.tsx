import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function ContentDrivenFramingSection() {
  return (
    <SiteSection>
      <Identified as="ContentDrivenFramingSection">
      <SiteSectionHeading kicker="The derivative-work framing" className="mb-6" />
      <blockquote className="max-w-3xl border-l-4 border-pink-500/60 pl-5 text-lg italic leading-8 text-foreground/90">
        &quot;This is a content-driven hypothesis, like starting out with some content first — much like making a game or
        movie based on a book or story. It&apos;s derivative, not all the processes are, much like a forger might not use
        the exact same brush.&quot;
      </blockquote>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        The value of derivative work is real — adaptations regularly outperform originals on reach and often on quality
        when the adaptation is genuinely creative. The content-driven track asks whether that effect shows up in
        agent-authored games: given authored canon to build on, does the agent produce something better than it would
        from scratch, or does the canon constrain the creativity that would otherwise emerge?
      </p>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        This is why content-pack runs <strong className="text-foreground">must not</strong> be scored against the same
        rubric as greenfield runs. A movie adapted from a book is not a worse movie because it didn&apos;t have to invent
        the plot — it&apos;s a different kind of movie with different success criteria. The rubric for this track will
        score derivative coherence, integration, and scope expansion, not originality.
      </p>
      </Identified>
    </SiteSection>
  );
}
