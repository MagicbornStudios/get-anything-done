import { MessageCircle, Terminal, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WorkflowExampleTurn } from "@/components/landing/workflow/workflow-shared";

type Props = {
  turn: WorkflowExampleTurn;
};

export function WorkflowSessionTurn({ turn }: Props) {
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <div
        className={[
          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
          turn.speaker === "user"
            ? "border-accent/60 bg-accent/10 text-accent"
            : turn.speaker === "agent"
              ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        ].join(" ")}
      >
        {turn.speaker === "user" ? (
          <User size={13} aria-hidden />
        ) : turn.speaker === "agent" ? (
          <MessageCircle size={13} aria-hidden />
        ) : (
          <Terminal size={13} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Badge
            variant="outline"
            className={
              turn.speaker === "user"
                ? "border-accent/40 text-accent"
                : turn.speaker === "agent"
                  ? "border-sky-500/40 text-sky-300"
                  : "border-emerald-500/40 text-emerald-300"
            }
          >
            {turn.speaker}
          </Badge>
        </div>
        <p
          className={[
            "text-sm leading-6",
            turn.speaker === "tool" ? "font-mono text-muted-foreground" : "text-foreground",
          ].join(" ")}
        >
          {turn.text}
        </p>
      </div>
    </li>
  );
}
