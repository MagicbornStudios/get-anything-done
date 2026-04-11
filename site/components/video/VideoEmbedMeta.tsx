import type { CompositionEntry } from "@/remotion/registry";
import { Badge } from "@/components/ui/badge";

export default function VideoEmbedMeta({ composition }: { composition: CompositionEntry }) {
  return (
    <div className="mt-3">
      <h3 className="text-base font-semibold text-foreground">{composition.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{composition.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {composition.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="font-mono text-[10px] font-normal text-muted-foreground">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
