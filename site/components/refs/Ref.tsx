"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefColorCodedId } from "./RefColorCodedId";
import { resolveRef } from "./ref-resolve";
import { REF_KIND_TINT } from "./ref-segment-styles";

/**
 * Resolve a structured planning ID to its anchor URL on the site.
 *
 * Tasks, phases, and bugs open under /planning (tab + hash); /tasks, /phases, /bugs redirect there.
 *
 * Supported id patterns:
 *   gad-NN / GAD-D-NN     → /decisions#gad-NN
 *   NN-NN / GAD-T-NN-NN   → /planning?tab=tasks#NN-NN
 *   P-NN / GAD-P-NN       → /planning?tab=phases#NN
 *   R-vX.YY               → /roadmap
 *   Q-slug / kebab        → /questions#slug
 *   B-slug / kebab        → /planning?tab=bugs#slug
 */

interface RefProps {
  id: string;
  children?: ReactNode;
  chip?: boolean;
}

export function Ref({ id, children, chip = true }: RefProps) {
  const resolved = resolveRef(id);
  const label = children ?? <RefColorCodedId segments={resolved.segments} />;

  const stateClass = resolved.found
    ? REF_KIND_TINT[resolved.kind] ?? REF_KIND_TINT.unknown
    : "border-rose-500/40 bg-rose-500/5 text-rose-400";

  const chipContent = (
    <span
      className={cn(
        badgeVariants({ variant: "outline" }),
        "rounded-md px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal shadow-none focus:outline-none focus:ring-0",
        stateClass,
      )}
    >
      {label}
    </span>
  );

  const linkChipClassName =
    "inline-flex max-w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const hasHoverContent = resolved.preview || resolved.detail;

  if (chip) {
    const inner =
      resolved.href && resolved.found ? (
        <Link href={resolved.href} className={linkChipClassName}>
          {chipContent}
        </Link>
      ) : (
        chipContent
      );

    if (!hasHoverContent) return inner;

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {resolved.href && resolved.found ? (
            <Link href={resolved.href} className={linkChipClassName}>
              {chipContent}
            </Link>
          ) : (
            chipContent
          )}
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="start" className="w-72">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RefColorCodedId segments={resolved.segments} />
              <Badge variant="outline" className="text-[9px] normal-case tracking-normal">
                {resolved.kind}
              </Badge>
            </div>
            {resolved.preview && (
              <p className="text-xs font-medium text-foreground">{resolved.preview}</p>
            )}
            {resolved.detail && (
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                {Object.entries(resolved.detail).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground/70 uppercase tracking-wider">{k}</dt>
                    <dd className="truncate font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground/60">
              {resolved.segments.namespace && <span>{resolved.segments.namespace} = project · </span>}
              {resolved.segments.type && (
                <span>
                  {resolved.segments.type} = {resolved.kind} ·{" "}
                </span>
              )}
              <span>
                {resolved.segments.number}
                {resolved.kind === "task" && resolved.segments.number.includes("-") && (
                  <>
                    {" "}
                    ({resolved.segments.number.split("-")[0]} = phase,{" "}
                    {resolved.segments.number.split("-")[1]} = task)
                  </>
                )}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  if (resolved.href && resolved.found) {
    return (
      <Link
        href={resolved.href}
        title={resolved.preview ?? id}
        className="cursor-help underline decoration-dotted decoration-accent/60 underline-offset-2 hover:text-accent hover:decoration-accent"
      >
        {label}
      </Link>
    );
  }
  return <span className="text-rose-400">{label}</span>;
}
