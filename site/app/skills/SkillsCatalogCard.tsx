import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillSummaryDTO } from "./skills-page-types";

export function SkillsCatalogCard({ skill, index }: { skill: SkillSummaryDTO; index?: number }) {
  const isFirst = index === 0;
  return (
    <Identified
      as="SkillsCatalogCardWrap"
      cid={isFirst ? "skills-catalog-card-first" : "skills-catalog-card"}
      className="block"
    >
      <Link href={`/skills/${skill.id}`} className="block">
        <Card className="group h-full overflow-hidden border-zinc-700/70 bg-gradient-to-b from-zinc-950 to-zinc-900 transition-colors hover:border-amber-400/60">
          <Identified as="SkillsCatalogCardArt" cid={isFirst ? "skills-catalog-card-art-first" : "skills-catalog-card-art"} className="relative h-32 border-b border-zinc-700/70 bg-zinc-950/90">
            {skill.imagePath ? (
              <Image
                src={skill.imagePath}
                alt={`${skill.name} icon`}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.20),rgba(24,24,27,0.95)_70%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
          </Identified>
          <CardHeader className="pb-2">
            <Identified as="SkillsCatalogCardBadges" cid={isFirst ? "skills-catalog-card-badges-first" : "skills-catalog-card-badges"} className="mb-2 flex flex-wrap items-center gap-2">
              {skill.origin === "official" ? (
                <Badge variant="default" className="bg-sky-500/20 text-sky-200">
                  official
                </Badge>
              ) : (
                <Badge variant="default" className="bg-amber-500/20 text-amber-200">
                  proto
                </Badge>
              )}
              {skill.isFundamental && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-200">
                  fundamental
                </Badge>
              )}
              {skill.authoredByEvals.length > 0 && (
                <Badge variant="outline" className="text-emerald-300">
                  eval-authored
                </Badge>
              )}
            </Identified>
            <CardTitle className="font-mono text-sm text-zinc-100">{skill.id}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="line-clamp-3 text-xs leading-5 text-zinc-300">{skill.description}</p>
            <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400">
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
    </Identified>
  );
}
