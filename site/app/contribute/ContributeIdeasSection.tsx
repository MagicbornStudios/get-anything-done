import { GitFork } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { ContributeIdeaCard } from "./ContributeIdeaCard";

export function ContributeIdeasSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={GitFork}
        kicker="What you can contribute"
        kickerRowClassName="mb-6 gap-3"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ContributeIdeaCard
          title="Run an existing eval"
          description="Pick any greenfield project (escape-the-dungeon, -bare, -emergent) and run it against the current requirements version. Compare your results to ours."
          firstStep={'"Run escape-the-dungeon-bare against requirements v5"'}
        />
        <ContributeIdeaCard
          title="Test a new hypothesis"
          description="Have an idea about agent behavior? Author a new hypothesis as a decision (gad-N), draft requirements, and run it as a new round per gad-72."
          firstStep={
            '"I want to test whether smaller token budgets force better planning. Help me design this experiment."'
          }
        />
        <ContributeIdeaCard
          title="Play and review a build"
          description="Open the Playable Archive, play any scored build, and submit a rubric review. Your scores feed the site automatically."
          firstStep={
            '"I just played escape-the-dungeon-bare v5. Submit a rubric review with these scores: ..."'
          }
        />
        <ContributeIdeaCard
          title="Author or evolve a skill"
          description="Use the create-skill / merge-skill / find-skills triumvirate (gad-73). New skills land in skills/ and get cataloged on the site."
          firstStep={'"Help me author a skill for finding kaplay sprite issues. Use create-skill."'}
        />
        <ContributeIdeaCard
          title="Log a bug or open a question"
          description="Found a bug while playing? Add it to data/bugs.json. Have an open research question? Add it to data/open-questions.json. Both render on the site."
          firstStep={
            '"Add a bug entry: rune forge lets me select the same rune twice in escape-the-dungeon-bare v5"'
          }
        />
        <ContributeIdeaCard
          title="Build a new eval flavor"
          description="Add a new eval project under evals/ — content-pack injection (gad-66), brownfield extension, codex-runtime comparison. Each becomes its own track on the site."
          firstStep={
            '"Set up a new eval project: escape-the-dungeon-codex. Same requirements as escape-the-dungeon, but the runner is codex-cli instead of claude-code."'
          }
        />
      </div>
    </SiteSection>
  );
}
