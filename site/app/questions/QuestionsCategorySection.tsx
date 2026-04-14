import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OpenQuestion } from "@/lib/eval-data";
import { QuestionCard } from "@/app/questions/QuestionCard";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function QuestionsCategorySection({
  category,
  questions,
}: {
  category: string;
  questions: OpenQuestion[];
}) {
  const label = category.replace(/-/g, " ");
  const categorySlug = category.replace(/[^a-zA-Z0-9]+/g, "-");
  return (
    <SiteSection
      id={category}
      tone="muted"
      className="last:border-b-0 last:bg-background"
    >
      <Identified as={`OpenQuestionsCategory-${categorySlug}`}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SiteSectionHeading
          icon={HelpCircle}
          kicker={label}
          kickerRowClassName="mb-0 flex-1 gap-3 capitalize"
          className="min-w-0 flex-1"
        />
        <Badge variant="outline" className="shrink-0">
          {questions.length}
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {questions.map((q) => (
          <QuestionCard key={q.id} q={q} />
        ))}
      </div>
      </Identified>
    </SiteSection>
  );
}

