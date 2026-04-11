import { Button } from "@/components/ui/button";

export function GraphsIntro() {
  return (
    <>
      <p className="section-kicker">Graphs</p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        All hypotheses, <span className="gradient-text">plotted.</span>
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        Interactive charts covering every scored run across all three workflow
        conditions (GAD, bare, emergent). Hover for details. The{" "}
        <Button
          variant="link"
          className="inline h-auto p-0 text-lg font-normal leading-8 text-accent underline decoration-dotted"
          asChild
        >
          <a href="#tracks">hypothesis tracks chart above</a>
        </Button>{" "}
        shows the cross-round trajectory; these show the per-run data points.
      </p>
    </>
  );
}
