import { Identified } from "@/components/devid/Identified";
import { LandingEvolutionLoopFeaturedSkillCard } from "./LandingEvolutionLoopFeaturedSkillCard";

const FEATURED_SKILL_IDS = [
  "create-proto-skill",
  "gad-visual-context-system",
  "find-sprites",
] as const;

/**
 * Three-column grid of featured skill preview tiles. The per-card dev-ids
 * come from the card component; this wrapper names the grid as a whole
 * so "the skills row under the evolution loop" has a single grep target.
 */
export function LandingEvolutionLoopFeaturedSkillsGrid() {
  return (
    <Identified
      as="LandingEvolutionLoopFeaturedSkillsGrid"
      className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {FEATURED_SKILL_IDS.map((id) => (
        <LandingEvolutionLoopFeaturedSkillCard key={id} skillId={id} />
      ))}
    </Identified>
  );
}
