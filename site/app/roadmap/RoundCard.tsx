import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RoundCard({
  round,
  title,
  body,
  pressure,
  status,
}: {
  round: string;
  title: string;
  body: string;
  pressure?: { value: number; tier: string; note: string; source: "computed" | "authored" };
  status: "completed" | "planned";
}) {
  return (
    <Card id={round.toLowerCase().replace(" ", "-")} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === "completed" ? "success" : "outline"}>{round}</Badge>
          {pressure && (
            <Badge variant="outline" className="inline-flex items-center gap-1.5">
              <Flame size={10} aria-hidden />
              pressure {pressure.value.toFixed(2)} ({pressure.tier})
            </Badge>
          )}
          <Badge variant={status === "completed" ? "outline" : "default"}>{status}</Badge>
        </div>
        <CardTitle className="mt-2 text-lg leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-muted-foreground">
          {body}
        </pre>
        {pressure && (
          <p className="mt-4 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <Flame size={9} className="mr-1 inline text-amber-400" aria-hidden />
            <strong className="text-foreground">Why this pressure rating:</strong>{" "}
            {pressure.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
