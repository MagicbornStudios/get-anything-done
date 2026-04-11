"use client";

import Link from "next/link";
import {
  ALL_DECISIONS,
  ALL_TASKS,
  ALL_PHASES,
  OPEN_QUESTIONS,
  BUGS,
} from "@/lib/eval-data";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";

/**
 * Resolve a structured planning ID to its anchor URL on the site.
 *
 * Tasks, phases, and bugs open under /planning (tab + hash); /tasks, /phases, /bugs redirect there.
 *
 * Supported id patterns:
 *   gad-NN / GAD-D-NN     → /decisions#gad-NN
 *   NN-NN / GAD-T-NN-NN   → /planning?tab=tasks#NN-NN
 *   P-NN / GAD-P-NN       → /planning?tab=phases#NN
 *   R-vX.YY               → /requirements#R-vX.YY
 *   Q-slug / kebab        → /questions#slug
 *   B-slug / kebab        → /planning?tab=bugs#slug
 */

type RefKind = "decision" | "task" | "phase" | "requirement" | "question" | "bug" | "unknown";

interface ResolvedRef {
  href: string | null;
  label: string;
  preview: string | null;
  detail: Record<string, string> | null;
  found: boolean;
  kind: RefKind;
  segments: { namespace?: string; type?: string; number: string };
}

function resolveRef(id: string): ResolvedRef {
  const base = { detail: null as Record<string, string> | null };

  // New format: PROJ-D-NN, PROJ-T-NN-NN, PROJ-P-NN
  const newFmt = id.match(/^([A-Z]+)-([DTPRBS])-(.+)$/);
  if (newFmt) {
    const [, ns, typeCode, num] = newFmt;
    const typeMap: Record<string, RefKind> = { D: "decision", T: "task", P: "phase", R: "requirement", B: "bug", S: "unknown" };
    const kind = typeMap[typeCode] || "unknown";

    if (kind === "decision") {
      const legacyId = `gad-${num}`;
      const decision = ALL_DECISIONS.find((d) => d.id === legacyId);
      return {
        ...base,
        href: `/decisions#${legacyId}`,
        label: id,
        preview: decision?.title ?? null,
        detail: decision ? { Status: "captured", Summary: decision.summary?.slice(0, 200) || "" } : null,
        found: !!decision,
        kind,
        segments: { namespace: ns, type: typeCode, number: num },
      };
    }
    if (kind === "task") {
      const task = ALL_TASKS.find((t) => t.id === num);
      const parts = num.split("-");
      return {
        ...base,
        href: `/planning?tab=tasks#${num}`,
        label: id,
        preview: task ? task.goal.slice(0, 180) : null,
        detail: task ? { Phase: parts[0] || "", Status: task.status, Goal: task.goal.slice(0, 150) } : null,
        found: !!task,
        kind,
        segments: { namespace: ns, type: typeCode, number: num },
      };
    }
    if (kind === "phase") {
      const phase = ALL_PHASES.find((p) => p.id === num);
      return {
        ...base,
        href: `/planning?tab=phases#${num}`,
        label: id,
        preview: phase?.title ?? null,
        detail: phase ? { Status: phase.status, Title: phase.title } : null,
        found: !!phase,
        kind,
        segments: { namespace: ns, type: typeCode, number: num },
      };
    }
  }

  // Legacy: Decisions — gad-NN
  if (/^gad-\d+$/i.test(id)) {
    const canonical = id.toLowerCase();
    const decision = ALL_DECISIONS.find((d) => d.id === canonical);
    return {
      ...base,
      href: `/decisions#${canonical}`,
      label: canonical,
      preview: decision?.title ?? null,
      detail: decision ? { Summary: decision.summary?.slice(0, 200) || "" } : null,
      found: !!decision,
      kind: "decision",
      segments: { namespace: "GAD", type: "D", number: canonical.replace("gad-", "") },
    };
  }

  // Legacy: Tasks — NN-NN
  if (/^\d{2}-\d{2}(-\d+[a-z]?)?$/i.test(id)) {
    const task = ALL_TASKS.find((t) => t.id === id);
    const parts = id.split("-");
    return {
      ...base,
      href: `/planning?tab=tasks#${id}`,
      label: `T-${id}`,
      preview: task ? task.goal.slice(0, 180) : null,
      detail: task ? { Phase: parts[0], Status: task.status, Goal: task.goal.slice(0, 150) } : null,
      found: !!task,
      kind: "task",
      segments: { namespace: "GAD", type: "T", number: id },
    };
  }

  // Phases — P-NN
  const phaseMatch = id.match(/^(?:P-)?(\d{1,3}(?:\.\d+)?)$/i);
  if (phaseMatch) {
    const phaseId = phaseMatch[1];
    const phase = ALL_PHASES.find((p) => p.id === phaseId);
    return {
      ...base,
      href: `/planning?tab=phases#${phaseId}`,
      label: `P-${phaseId}`,
      preview: phase?.title ?? null,
      detail: phase ? { Status: phase.status, Title: phase.title } : null,
      found: !!phase,
      kind: "phase",
      segments: { namespace: "GAD", type: "P", number: phaseId },
    };
  }

  // Requirements
  if (/^R-v\d+/i.test(id)) {
    return { ...base, href: `/requirements#${id}`, label: id, preview: `Requirement ${id}`, found: true, kind: "requirement", segments: { type: "R", number: id.replace("R-", "") } };
  }

  // Questions
  const questionId = id.replace(/^Q-/, "");
  const question = (OPEN_QUESTIONS ?? []).find((q) => q.id === questionId);
  if (question) {
    return { ...base, href: `/questions#${question.id}`, label: `Q-${question.id}`, preview: question.title, found: true, kind: "question", segments: { type: "Q", number: question.id } };
  }

  // Bugs
  const bugId = id.replace(/^B-/, "");
  const bug = (BUGS ?? []).find((b) => b.id === bugId);
  if (bug) {
    return { ...base, href: `/planning?tab=bugs#${bug.id}`, label: `B-${bug.id}`, preview: bug.title, found: true, kind: "bug", segments: { type: "B", number: bug.id } };
  }

  return { ...base, href: null, label: id, preview: null, found: false, kind: "unknown", segments: { number: id } };
}

const KIND_TINT: Record<string, string> = {
  decision: "border-accent/40 bg-accent/5 text-accent hover:bg-accent/15",
  task: "border-sky-500/40 bg-sky-500/5 text-sky-300 hover:bg-sky-500/15",
  phase: "border-purple-500/40 bg-purple-500/5 text-purple-300 hover:bg-purple-500/15",
  requirement: "border-amber-500/40 bg-amber-500/5 text-amber-300 hover:bg-amber-500/15",
  question: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15",
  bug: "border-rose-500/40 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15",
  unknown: "border-zinc-500/40 bg-zinc-500/5 text-zinc-400",
};

/** Color per segment type for the color-coded ID display */
const SEGMENT_COLORS: Record<string, string> = {
  namespace: "text-accent",
  D: "text-amber-400",
  T: "text-sky-400",
  P: "text-purple-400",
  R: "text-emerald-400",
  B: "text-rose-400",
  S: "text-cyan-400",
  Q: "text-teal-400",
  number: "text-foreground",
};

function ColorCodedId({ segments }: { segments: ResolvedRef["segments"] }) {
  return (
    <span className="font-mono text-[10px]">
      {segments.namespace && (
        <><span className={SEGMENT_COLORS.namespace}>{segments.namespace}</span><span className="text-muted-foreground/50">-</span></>
      )}
      {segments.type && (
        <><span className={SEGMENT_COLORS[segments.type] || "text-foreground"}>{segments.type}</span><span className="text-muted-foreground/50">-</span></>
      )}
      <span className={SEGMENT_COLORS.number}>{segments.number}</span>
    </span>
  );
}

interface RefProps {
  id: string;
  children?: React.ReactNode;
  chip?: boolean;
}

export function Ref({ id, children, chip = true }: RefProps) {
  const resolved = resolveRef(id);
  const label = children ?? <ColorCodedId segments={resolved.segments} />;

  const chipBase = "inline-flex items-center rounded border px-1.5 py-0.5 transition-colors";
  const stateClass = resolved.found
    ? KIND_TINT[resolved.kind] ?? KIND_TINT.unknown
    : "border-rose-500/40 bg-rose-500/5 text-rose-400";

  const chipContent = (
    <span className={`${chipBase} ${stateClass}`}>
      {label}
    </span>
  );

  // Wrap in HoverCard when we have detail or preview
  const hasHoverContent = resolved.preview || resolved.detail;

  if (chip) {
    const inner = resolved.href && resolved.found ? (
      <Link href={resolved.href}>{chipContent}</Link>
    ) : chipContent;

    if (!hasHoverContent) return inner;

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {resolved.href && resolved.found ? (
            <Link href={resolved.href}>{chipContent}</Link>
          ) : (
            chipContent
          )}
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="start" className="w-72">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ColorCodedId segments={resolved.segments} />
              <Badge variant="outline" className="text-[9px]">{resolved.kind}</Badge>
            </div>
            {resolved.preview && (
              <p className="text-xs font-medium text-foreground">{resolved.preview}</p>
            )}
            {resolved.detail && (
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                {Object.entries(resolved.detail).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground/70 uppercase tracking-wider">{k}</dt>
                    <dd className="font-medium text-foreground truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {/* Segment breakdown */}
            <div className="border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground/60">
              {resolved.segments.namespace && <span>{resolved.segments.namespace} = project · </span>}
              {resolved.segments.type && <span>{resolved.segments.type} = {resolved.kind} · </span>}
              <span>{resolved.segments.number}
                {resolved.kind === "task" && resolved.segments.number.includes("-") && (
                  <> ({resolved.segments.number.split("-")[0]} = phase, {resolved.segments.number.split("-")[1]} = task)</>
                )}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Inline underline form
  if (resolved.href && resolved.found) {
    return (
      <Link href={resolved.href} title={resolved.preview ?? id} className="cursor-help underline decoration-dotted decoration-accent/60 underline-offset-2 hover:decoration-accent hover:text-accent">
        {label}
      </Link>
    );
  }
  return <span className="text-rose-400">{label}</span>;
}
