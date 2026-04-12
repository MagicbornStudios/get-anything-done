import Link from "next/link";
import { SiteSectionIntro } from "@/components/site";

export function HypothesisTracksIntro() {
  return (
    <SiteSectionIntro
      kicker="Hypothesis tracks"
      preset="hero-compact"
      title={
        <>
          Every hypothesis, <span className="gradient-text">one line per round.</span>
        </>
      }
    >
      Each line is a research track we are testing. Freedom = bare workflow. CSH = emergent
      workflow. GAD framework = full framework. Planned tracks (content-driven, codex runtime)
      show as dashed ghost lines so you can see the research plan even where no data exists yet.{" "}
      <strong className="text-foreground">Click a round</strong> to filter the Playable Archive
      below. Read{" "}
      <Link href="/skeptic" className="text-accent underline decoration-dotted">
        /skeptic
      </Link>{" "}
      before trusting any individual point — sample sizes are small.
    </SiteSectionIntro>
  );
}
