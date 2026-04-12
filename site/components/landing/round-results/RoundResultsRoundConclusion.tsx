import type { RoundSummary } from "@/lib/eval-data";
import { SiteSectionHeading } from "@/components/site";

type Props = {
  roundLabel: string;
  summary: RoundSummary;
};

function LedToList({ body }: { body: string }) {
  const ledToMatch = body.match(/\*\*Led to:\*\*([\s\S]*?)(?:\n---|\n\*\*|$)/);
  if (!ledToMatch) return <p>See experiment log for full details.</p>;
  const items = ledToMatch[1]
    .split("\n")
    .map((l) => l.replace(/^\s*-\s+/, "").trim())
    .filter(Boolean);
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function RoundResultsRoundConclusion({ roundLabel, summary }: Props) {
  return (
    <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
      <SiteSectionHeading
        kicker={`${roundLabel} conclusion`}
        as="h3"
        title={summary.title}
        titleClassName="mt-1 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl"
      />
      <div className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
        <LedToList body={summary.body} />
      </div>
    </div>
  );
}
