import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ContributeStepProps = {
  num: string;
  title: string;
  code?: string;
  note?: string;
  examples?: string[];
};

export function ContributeStep({ num, title, code, note, examples }: ContributeStepProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="size-7 shrink-0 justify-center rounded-full border-accent/40 bg-accent/10 p-0 font-mono text-sm font-semibold normal-case tracking-normal text-accent"
          >
            {num}
          </Badge>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {code && (
          <pre className="mb-3 overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs leading-6 text-foreground/90">
            {code}
          </pre>
        )}
        {note && <p className="text-sm leading-6 text-muted-foreground">{note}</p>}
        {examples && examples.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm leading-6">
            {examples.map((e, i) => (
              <li
                key={i}
                className="rounded border border-border/40 bg-background/40 px-3 py-1.5 text-xs italic text-muted-foreground"
              >
                {e}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
