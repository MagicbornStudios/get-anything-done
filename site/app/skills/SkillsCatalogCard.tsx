import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillSummaryDTO } from "./skills-page-types";

export function SkillsCatalogCard({ skill }: { skill: SkillSummaryDTO }) {
  return (
    <Link href={`/skills/${skill.id}`} className="block">
      <Card className="h-full transition-colors hover:border-accent/60">
        <CardHeader className="pb-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {skill.isFundamental && (
              <Badge variant="default" className="bg-amber-500/15 text-amber-300">
                fundamental
              </Badge>
            )}
            {skill.isFrameworkSkill && (
              <Badge variant="outline" className="border-violet-500/50 text-violet-300">
                Framework
              </Badge>
            )}
            {skill.authoredByEvals.length > 0 && (
              <Badge variant="outline" className="text-emerald-300">
                eval-authored
              </Badge>
            )}
          </div>
          <CardTitle className="font-mono text-base">{skill.id}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{skill.description}</p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {skill.inheritedBy.length > 0
                ? `inherited by ${skill.inheritedBy.length}`
                : "framework-only"}
            </span>
            <ArrowRight size={11} aria-hidden />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
