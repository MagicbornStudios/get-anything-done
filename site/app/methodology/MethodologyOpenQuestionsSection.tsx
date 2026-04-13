import { OPEN_QUESTIONS } from "@/lib/eval-data";
import { QuestionsCategorySection } from "@/app/questions/QuestionsCategorySection";
import { QuestionsResolvedSection } from "@/app/questions/QuestionsResolvedSection";
import { groupByCategory } from "@/app/questions/questions-shared";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export function MethodologyOpenQuestionsSection() {
  const open = OPEN_QUESTIONS.filter((q) => q.status !== "resolved");
  const resolved = OPEN_QUESTIONS.filter((q) => q.status === "resolved");
  const grouped = groupByCategory(open);
  const categories = Object.keys(grouped).sort();

  if (OPEN_QUESTIONS.length === 0) return null;

  return (
    <>
      <SiteSection id="open-questions" className="border-t border-border/60">
        <Identified as="MethodologyOpenQuestionsIntroSection">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Open questions</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            The unresolved questions about the hypothesis, evaluation approach, and framework —
            public backlog of what is still being worked out.
          </p>
          <div className="mt-2 text-xs text-muted-foreground">
            {open.length} open · {resolved.length} resolved · {categories.length} categories
          </div>
        </Identified>
      </SiteSection>

      {categories.map((cat) => (
        <QuestionsCategorySection key={cat} category={cat} questions={grouped[cat]} />
      ))}

      <QuestionsResolvedSection resolved={resolved} />
    </>
  );
}
