import Link from "next/link";
import {
  ALL_DECISIONS,
  ALL_TASKS,
  ALL_PHASES,
  OPEN_QUESTIONS,
  BUGS,
} from "@/lib/eval-data";

/**
 * Resolve a structured planning ID to its anchor URL on the site.
 *
 * Supported id patterns:
 *   gad-NN            → /decisions#gad-NN
 *   NN-NN (task id)   → /tasks#NN-NN
 *   P-NN / phase NN   → /phases#NN
 *   R-vX.YY           → /requirements#R-vX.YY
 *   Q-slug / kebab    → /questions#slug
 *   B-slug / kebab    → /bugs#slug
 *
 * Returns { href, label, preview, found, kind }.
 */
function resolveRef(id: string): {
  href: string | null;
  label: string;
  preview: string | null;
  found: boolean;
  kind: "decision" | "task" | "phase" | "requirement" | "question" | "bug" | "unknown";
} {
  // Decisions — gad-NN
  if (/^gad-\d+$/i.test(id)) {
    const canonical = id.toLowerCase();
    const decision = ALL_DECISIONS.find((d) => d.id === canonical);
    return {
      href: `/decisions#${canonical}`,
      label: canonical,
      preview: decision?.title ?? null,
      found: !!decision,
      kind: "decision",
    };
  }

  // Tasks — NN-NN (two numeric groups) or NN-NN-NN
  if (/^\d{2}-\d{2}(-\d+[a-z]?)?$/i.test(id)) {
    const task = ALL_TASKS.find((t) => t.id === id);
    return {
      href: `/tasks#${id}`,
      label: `T-${id}`,
      preview: task ? task.goal.slice(0, 180) : null,
      found: !!task,
      kind: "task",
    };
  }

  // Phases — P-NN or bare numeric phase id
  const phaseMatch = id.match(/^(?:P-)?(\d{1,3}(?:\.\d+)?)$/i);
  if (phaseMatch) {
    const phaseId = phaseMatch[1];
    const phase = ALL_PHASES.find((p) => p.id === phaseId);
    return {
      href: `/phases#${phaseId}`,
      label: `P-${phaseId}`,
      preview: phase?.title ?? null,
      found: !!phase,
      kind: "phase",
    };
  }

  // Requirements — R-vX.YY
  if (/^R-v\d+\.\d+$/i.test(id)) {
    return {
      href: `/requirements#${id}`,
      label: id,
      preview: `Requirement ${id}`,
      found: true, // we don't parse addendum on the client, but /requirements renders them
      kind: "requirement",
    };
  }

  // Open questions — Q-slug or bare slug
  const questionId = id.replace(/^Q-/, "");
  const question = OPEN_QUESTIONS.find((q) => q.id === questionId);
  if (question) {
    return {
      href: `/questions#${question.id}`,
      label: `Q-${question.id}`,
      preview: question.title,
      found: true,
      kind: "question",
    };
  }

  // Bugs — B-slug or bare slug
  const bugId = id.replace(/^B-/, "");
  const bug = BUGS.find((b) => b.id === bugId);
  if (bug) {
    return {
      href: `/bugs#${bug.id}`,
      label: `B-${bug.id}`,
      preview: bug.title,
      found: true,
      kind: "bug",
    };
  }

  return { href: null, label: id, preview: null, found: false, kind: "unknown" };
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

interface RefProps {
  /** Structured ID like "gad-68", "22-11", "R-v5.13", or a question/bug slug */
  id: string;
  /** Optional override label. Defaults to the canonical form. */
  children?: React.ReactNode;
  /** Render as a compact chip (default). If false, renders inline underline. */
  chip?: boolean;
}

export function Ref({ id, children, chip = true }: RefProps) {
  const resolved = resolveRef(id);
  const label = children ?? resolved.label;
  const title = resolved.preview ?? `Unresolved: ${id}`;

  if (chip) {
    const baseClass =
      "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors";
    const stateClass = resolved.found
      ? KIND_TINT[resolved.kind] ?? KIND_TINT.unknown
      : "border-rose-500/40 bg-rose-500/5 text-rose-400";

    if (resolved.href && resolved.found) {
      return (
        <Link href={resolved.href} title={title} className={`${baseClass} ${stateClass}`}>
          {label}
        </Link>
      );
    }
    return (
      <span title={title} className={`${baseClass} ${stateClass}`}>
        {label}
      </span>
    );
  }

  // Inline underline form
  if (resolved.href && resolved.found) {
    return (
      <Link
        href={resolved.href}
        title={title}
        className="cursor-help underline decoration-dotted decoration-accent/60 underline-offset-2 hover:decoration-accent hover:text-accent"
      >
        {label}
      </Link>
    );
  }
  return (
    <span title={title} className="text-rose-400">
      {label}
    </span>
  );
}
