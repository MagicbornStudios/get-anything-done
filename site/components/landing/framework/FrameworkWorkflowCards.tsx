import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WORKFLOW_DESCRIPTIONS, WORKFLOW_LABELS } from "@/lib/eval-data";
import { FRAMEWORK_WORKFLOW_ORDER } from "@/components/landing/framework/framework-shared";

export function FrameworkWorkflowCards() {
  return (
    <div className="mt-14 grid gap-5 lg:grid-cols-3">
      {FRAMEWORK_WORKFLOW_ORDER.map((wf) => (
        <Card key={wf} className="flex h-full flex-col">
          <CardHeader>
            <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              Workflow
            </div>
            <CardTitle className="text-2xl">{WORKFLOW_LABELS[wf]}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <CardDescription className="text-base leading-7">
              {WORKFLOW_DESCRIPTIONS[wf]}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
