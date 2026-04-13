import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { GAD_CORE_CONCEPTS } from "./gad-core-concepts";

export function GadCoreConceptsSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="GadCoreConceptsSection">
      <Identified as="GadCoreConceptsHeading" register={false}>
        <SiteSectionHeading kicker="Core concepts" title="Three moving parts" preset="section" />
      </Identified>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {GAD_CORE_CONCEPTS.map((c) => {
          const Icon = c.icon;
          return (
            <Identified key={c.title} as={`GadCoreConceptCard-${c.href.replace(/[^a-z0-9]+/gi, "-")}`}>
            <Card className="group">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-accent">
                    <Icon size={20} aria-hidden />
                  </div>
                  <Badge variant="outline" className="tabular-nums">
                    {c.count}
                  </Badge>
                </div>
                <CardTitle>{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-7">{c.description}</CardDescription>
                <Button variant="link" className="mt-4 h-auto gap-1 p-0 text-xs font-semibold text-accent" asChild>
                  <Link href={c.href}>
                    {c.chip}
                    <ArrowRight size={12} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            </Identified>
          );
        })}
      </div>
      </Identified>
    </SiteSection>
  );
}
