import { SiteSectionIntro } from "@/components/site";

export function FrameworkIntro() {
  return (
    <SiteSectionIntro
      kicker="The eval framework"
      preset="hero-compact"
      title={
        <>
          Three workflows. <span className="gradient-text">One scoring formula.</span> No hiding
          behind process metrics.
        </>
      }
    >
      Each eval project ships a{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">REQUIREMENTS.xml</code> with
      versioned gate criteria. Every run produces a{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">TRACE.json</code> with a
      composite score. Process metrics matter, but they cannot rescue a run that ships a broken
      game — human review weighs 30% precisely so &quot;the process was followed&quot; isn&apos;t
      a free pass.
    </SiteSectionIntro>
  );
}

