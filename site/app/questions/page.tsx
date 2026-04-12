import { OPEN_QUESTIONS } from "@/lib/eval-data";
import { MarketingShell } from "@/components/site";
import { QuestionsCategorySection } from "@/app/questions/QuestionsCategorySection";
import { QuestionsEmptyState } from "@/app/questions/QuestionsEmptyState";
import { QuestionsHero } from "@/app/questions/QuestionsHero";
import { QuestionsResolvedSection } from "@/app/questions/QuestionsResolvedSection";
import { groupByCategory } from "@/app/questions/questions-shared";

export const metadata = {
  title: "Open questions — GAD",
  description:
    "The unresolved questions about the project, hypothesis, evaluation approach, and framework. Public backlog of what is still being worked out.",
};

export default function QuestionsPage() {
  const open = OPEN_QUESTIONS.filter((q) => q.status !== "resolved");
  const resolved = OPEN_QUESTIONS.filter((q) => q.status === "resolved");
  const grouped = groupByCategory(open);
  const categories = Object.keys(grouped).sort();

  return (
    <MarketingShell>
      <QuestionsHero
        openCount={open.length}
        resolvedCount={resolved.length}
        categoryCount={categories.length}
      />

      {categories.map((cat) => (
        <QuestionsCategorySection key={cat} category={cat} questions={grouped[cat]} />
      ))}

      <QuestionsResolvedSection resolved={resolved} />

      {OPEN_QUESTIONS.length === 0 && <QuestionsEmptyState />}
    </MarketingShell>
  );
}
