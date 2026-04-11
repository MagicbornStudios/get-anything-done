import type { CompositionEntry } from "@/remotion/registry";

export default function VideoEmbedMeta({ composition }: { composition: CompositionEntry }) {
  return (
    <div className="mt-3">
      <h3 className="text-base font-semibold text-foreground">{composition.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{composition.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        {composition.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border/70 bg-card/40 px-2 py-0.5 font-mono text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
