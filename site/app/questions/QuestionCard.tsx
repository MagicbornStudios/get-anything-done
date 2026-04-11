import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import type { OpenQuestion } from "@/lib/eval-data";
import { CATEGORY_TINT, STATUS_TINT } from "@/app/questions/questions-shared";

export function QuestionCard({ q }: { q: OpenQuestion }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
              CATEGORY_TINT[q.category] ?? "border-border/60 text-muted-foreground"
            }`}
          >
            {q.priority}
          </span>
          <Badge variant={STATUS_TINT[q.status] ?? "outline"}>{q.status}</Badge>
          <span className="text-[10px] text-muted-foreground tabular-nums">{q.opened_on}</span>
        </div>
        <CardTitle className="text-base leading-tight">{q.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-6 text-muted-foreground">{q.context}</p>
        {(q.related_decisions.length > 0 || q.related_requirements.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {q.related_decisions.map((d) => (
              <Ref key={d} id={d} />
            ))}
            {q.related_requirements.map((r) => (
              <Ref key={r} id={r} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
