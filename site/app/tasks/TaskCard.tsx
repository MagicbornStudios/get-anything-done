import Link from "next/link";
import { CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskRecord } from "@/lib/eval-data";
import { Ref } from "@/components/refs/Ref";
import { STATUS_ICON, STATUS_TINT } from "./tasks-shared";

export default function TaskCard({ task }: { task: TaskRecord }) {
  const Icon = STATUS_ICON[task.status] ?? CircleDot;
  return (
    <Card id={task.id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Ref id={task.id} />
            <Badge variant={STATUS_TINT[task.status] ?? "outline"} className="inline-flex items-center gap-1">
              <Icon size={10} aria-hidden />
              {task.status}
            </Badge>
          </div>
          <Link
            href={`#${task.id}`}
            className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
          >
            #{task.id}
          </Link>
        </div>
        <CardTitle className="mt-2 text-sm font-normal leading-6 text-foreground/90">
          {task.goal}
        </CardTitle>
      </CardHeader>
      {(task.keywords.length > 0 || task.depends.length > 0) && (
        <CardContent className="pt-0">
          {task.keywords.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              {task.keywords.map((k) => (
                <span key={k} className="rounded bg-background/60 px-1.5 py-0.5">
                  {k}
                </span>
              ))}
            </div>
          )}
          {task.depends.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="uppercase tracking-wider">depends on:</span>
              {task.depends.map((d) => (
                <Ref key={d} id={d} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
