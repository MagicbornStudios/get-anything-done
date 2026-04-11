import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { RubricEmptyState } from "@/app/rubric/RubricEmptyState";
import { RubricHero } from "@/app/rubric/RubricHero";
import { RubricProjectSection } from "@/app/rubric/RubricProjectSection";
import { RubricWeightsSection } from "@/app/rubric/RubricWeightsSection";
import { getProjectsWithRubric } from "@/app/rubric/rubric-shared";

export const metadata = {
  title: "Human review rubric — GAD",
  description:
    "The scored dimensions a human reviewer uses when playing an eval run. Per-project weights, per-dimension descriptions, and the CLI command to submit a review.",
};

export default function RubricPage() {
  const projectsWithRubric = getProjectsWithRubric();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <RubricHero />
      <RubricWeightsSection />

      {projectsWithRubric.map((project) => (
        <RubricProjectSection key={project.id} project={project} />
      ))}

      {projectsWithRubric.length === 0 && <RubricEmptyState />}

      <Footer />
    </main>
  );
}
