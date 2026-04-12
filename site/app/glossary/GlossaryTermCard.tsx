import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import type { GlossaryTerm } from "@/lib/eval-data";
import { GlossaryDefinitionBlocks } from "./GlossaryDefinitionBlocks";

export function GlossaryTermCard({ term: t }: { term: GlossaryTerm }) {
  return (
    <Card id={t.id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg leading-tight">{t.term}</CardTitle>
        {t.aliases.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
            aliases:
            {t.aliases.map((a) => (
              <code key={a} className="rounded bg-background/60 px-1 py-0.5 font-mono">
                {a}
              </code>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 border-l-2 border-accent/60 pl-3 text-sm italic leading-6 text-foreground/90">
          {t.short}
        </p>
        <div>
          <GlossaryDefinitionBlocks text={t.full} />
        </div>
        {(t.related_decisions.length > 0 || t.related_terms.length > 0) && (
          <div className="mt-4 space-y-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
            {t.related_decisions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider">decisions:</span>
                {t.related_decisions.map((d) => (
                  <Ref key={d} id={d} />
                ))}
              </div>
            )}
            {t.related_terms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider">see also:</span>
                {t.related_terms.map((rt) => (
                  <a
                    key={rt}
                    href={`#${rt}`}
                    className="inline-flex items-center gap-0.5 rounded border border-accent/40 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/10"
                  >
                    {rt}
                    <ArrowRight size={9} aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
