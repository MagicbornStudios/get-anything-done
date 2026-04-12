import { SiteSectionIntro } from "@/components/site";

export function InsightsPageIntro() {
  return (
    <header className="max-w-3xl">
      <SiteSectionIntro
        kicker="Insights"
        as="h1"
        preset="hero-compact"
        title={
          <>
            Structured data from every eval, <span className="gradient-text">every session.</span>
          </>
        }
      >
        Curated queries against eval traces, planning artifacts, and self-evaluation metrics. Every
        number on this page has a source — computed from TRACE.json, TASK-REGISTRY.xml,
        DECISIONS.xml, and .gad-log/ trace data at build time.
      </SiteSectionIntro>
    </header>
  );
}
