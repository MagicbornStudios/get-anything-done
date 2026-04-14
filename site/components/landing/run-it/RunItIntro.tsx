import { SiteSectionIntro } from "@/components/site";

export function RunItIntro() {
  return (
    <SiteSectionIntro
      kicker="Run it locally"
      preset="hero-compact"
      title={
        <>
          One repo. <span className="gradient-text">One CLI.</span> Five commands to your first eval
          run.
        </>
      }
    >
      The CLI lives at{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">bin/gad.cjs</code>. The eval
      projects live under{" "}
      <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/</code>. Everything else
      is committed planning state. No services, no auth, no telemetry.
    </SiteSectionIntro>
  );
}

