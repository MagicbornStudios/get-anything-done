import { Badge } from "@/components/ui/badge";
import { ROUNDS_BORDER_TINT } from "@/components/landing/rounds/rounds-shared";
import { RoundsMarkdownBody } from "@/components/landing/rounds/RoundsMarkdownBody";
import type { RoundSummary } from "@/lib/eval-data";

type Props = {
  summary: RoundSummary;
};

export function RoundsArticle({ summary: r }: Props) {
  return (
    <div className="mt-6">
      <article
        className={`rounded-2xl border border-l-4 bg-card/40 p-6 md:p-8 ${ROUNDS_BORDER_TINT[r.round] ?? "border-l-border"}`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="default">{r.round}</Badge>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{r.title}</h3>
        </div>
        <RoundsMarkdownBody body={r.body} />
      </article>
    </div>
  );
}
