import { Button } from "@/components/ui/button";
import { SiteProse, SiteSectionHeading } from "@/components/site";

export function GraphsIntro() {
  return (
    <>
      <SiteSectionHeading
        kicker="Graphs"
        preset="hero-compact"
        title={
          <>
            All hypotheses, <span className="gradient-text">plotted.</span>
          </>
        }
      />
      <SiteProse className="mt-5">
        Interactive charts covering every scored run across all three workflow conditions (GAD,
        bare, emergent). Hover for details. The{" "}
        <Button
          variant="link"
          className="inline h-auto p-0 text-lg font-normal leading-8 text-accent underline decoration-dotted"
          asChild
        >
          <a href="#tracks">hypothesis tracks chart above</a>
        </Button>{" "}
        shows the cross-round trajectory; these show the per-run data points.
      </SiteProse>
    </>
  );
}
