import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ContributeIdeaCardProps = {
  title: string;
  description: string;
  firstStep: string;
};

export function ContributeIdeaCard({ title, description, firstStep }: ContributeIdeaCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="flex items-center gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-xs italic text-accent">
          <MessageSquare size={11} className="shrink-0" aria-hidden />
          {firstStep}
        </div>
      </CardContent>
    </Card>
  );
}
