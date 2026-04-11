import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OpenQuestion } from "@/lib/eval-data";
import { QuestionCard } from "@/app/questions/QuestionCard";

export function QuestionsCategorySection({
  category,
  questions,
}: {
  category: string;
  questions: OpenQuestion[];
}) {
  return (
    <section
      id={category}
      className="border-b border-border/60 bg-card/20 last:bg-background last:border-b-0"
    >
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <HelpCircle size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0 capitalize">{category.replace("-", " ")}</p>
          <Badge variant="outline">{questions.length}</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      </div>
    </section>
  );
}
