import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EVAL_PROJECTS } from "@/lib/eval-data";

const MAX_DISPLAY = 5;

export default function SkillDetailInheritanceCard({
  inheritedBy,
}: {
  inheritedBy: string[];
}) {
  if (inheritedBy.length > 0) {
    const displayed = inheritedBy.slice(0, MAX_DISPLAY);
    const remaining = inheritedBy.length - MAX_DISPLAY;

    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5 shadow-none">
        <CardContent className="space-y-3 p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-400">
            Inherited by {inheritedBy.length} project{inheritedBy.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Eval projects that copy this skill into their template/skills/ bootstrap set.
          </p>
          <ul className="space-y-2">
            {displayed.map((project) => {
              const evalProject = EVAL_PROJECTS.find((p) => p.id === project);
              return (
                <li key={project}>
                  <Link
                    href={`/projects/${project}`}
                    className="group flex items-center gap-2 rounded-lg border border-border/40 bg-card/30 px-3 py-2 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
                  >
                    <code className="text-xs font-semibold text-foreground group-hover:text-emerald-300">
                      {project}
                    </code>
                    {evalProject?.evalMode && (
                      <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        {evalProject.evalMode}
                      </span>
                    )}
                    <ArrowRight
                      size={10}
                      className="ml-auto text-muted-foreground/40 group-hover:text-emerald-400"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          {remaining > 0 && (
            <p className="text-[11px] text-muted-foreground">
              + {remaining} more project{remaining !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/30 shadow-none">
      <CardContent className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Framework-only</p>
        <p className="text-xs text-muted-foreground">
          This skill is available to the main GAD agent but is not yet copied into any eval
          project&apos;s bootstrap skill set.
        </p>
      </CardContent>
    </Card>
  );
}
