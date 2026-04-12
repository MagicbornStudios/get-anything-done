import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GLOSSARY_CATEGORY_TINT } from "./glossary-shared";
import type { GlossaryTerm } from "@/lib/eval-data";

export function GlossaryCategoryJumpNav({
  orderedCategories,
  grouped,
}: {
  orderedCategories: string[];
  grouped: Record<string, GlossaryTerm[]>;
}) {
  return (
    <nav className="mt-6 flex flex-wrap gap-2">
      {orderedCategories.map((cat) => (
        <Button
          key={cat}
          variant="outline"
          size="sm"
          className={cn(
            "h-auto rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider hover:brightness-125",
            GLOSSARY_CATEGORY_TINT[cat] ?? "border-border/60 text-muted-foreground",
          )}
          asChild
        >
          <a href={`#category-${cat}`}>
            {cat.replace(/-/g, " ")} ({grouped[cat].length})
          </a>
        </Button>
      ))}
    </nav>
  );
}
