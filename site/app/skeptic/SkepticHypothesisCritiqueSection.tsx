import { AlertOctagon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Identified } from "@/components/devid/Identified";
import { Ref } from "@/components/refs/Ref";
import { SiteSection } from "@/components/site";
import type { Critique } from "./skeptic-shared";

export default function SkepticHypothesisCritiqueSection({
  critique: c,
}: {
  critique: Critique;
}) {
  const pid = `SkepticCritique-${c.id}`;
  return (
    <SiteSection id={c.id} className="last:bg-background">
      <Identified as={`${pid}-Title`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Ref id={c.ref} />
          <Badge variant="outline">hypothesis</Badge>
        </div>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">{c.hypothesis}</h2>
      </Identified>

      <Identified as={`${pid}-Steelman`} className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          Steelman
        </p>
        <p className="text-sm leading-6 text-foreground/90">{c.steelman}</p>
      </Identified>

      <Identified as={`${pid}-Problems`} className="mt-4">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
          <AlertOctagon size={12} aria-hidden />
          Problems with the claim
        </p>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {c.problems.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded border border-rose-500/20 bg-rose-500/5 px-3 py-2"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Identified>

      <Identified as={`${pid}-Alternatives`} className="mt-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Alternative explanations for the same data
        </p>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {c.alternatives.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </Identified>

      <Identified as={`${pid}-Falsification`} className="mt-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          What would falsify this
        </p>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {c.falsification.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded border border-sky-500/20 bg-sky-500/5 px-3 py-2"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Identified>

      <Identified as={`${pid}-HonestStatus`} className="mt-6 rounded-xl border border-border/70 bg-card/40 p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Honest current status
        </p>
        <p className="text-sm leading-6 text-foreground/90">{c.honestStatus}</p>
      </Identified>
    </SiteSection>
  );
}
