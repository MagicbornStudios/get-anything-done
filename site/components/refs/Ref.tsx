import Link from "next/link";
import { ALL_DECISIONS, OPEN_QUESTIONS, BUGS } from "@/lib/eval-data";

/**
 * Resolve a structured planning ID to its anchor URL on the site.
 *
 * Supported id patterns:
 *   gad-NN            → /decisions#gad-NN
 *   R-vX.YY           → /requirements#R-vX.YY  (page not yet built → /decisions fallback)
 *   Q-slug / question slug → /questions#<slug>
 *   B-slug / bug slug      → (page not built yet)
 *
 * Returns { href, label, preview, found } so the component can decide whether
 * to render a link or plain text.
 */
function resolveRef(id: string): {
  href: string | null;
  label: string;
  preview: string | null;
  found: boolean;
} {
  // Decisions — gad-NN
  if (/^gad-\d+$/i.test(id)) {
    const canonical = id.toLowerCase();
    const decision = ALL_DECISIONS.find((d) => d.id === canonical);
    if (decision) {
      return {
        href: `/decisions#${canonical}`,
        label: canonical,
        preview: decision.title,
        found: true,
      };
    }
    return { href: `/decisions#${canonical}`, label: canonical, preview: null, found: false };
  }

  // Requirements — R-vX.YY
  if (/^R-v\d+\.\d+$/i.test(id)) {
    // /requirements page not yet built; fall back to raw anchor on /decisions for now
    return {
      href: `/#${id}`,
      label: id,
      preview: `Requirement ${id}`,
      found: false,
    };
  }

  // Open questions — match either the kebab-case slug directly or a Q- prefix
  const questionId = id.replace(/^Q-/, "");
  const question = OPEN_QUESTIONS.find((q) => q.id === questionId);
  if (question) {
    return {
      href: `/questions#${question.id}`,
      label: `Q-${question.id}`,
      preview: question.title,
      found: true,
    };
  }

  // Bugs — match B- prefix or slug
  const bugId = id.replace(/^B-/, "");
  const bug = BUGS.find((b) => b.id === bugId);
  if (bug) {
    return {
      href: `/questions#${bug.id}`, // no /bugs page yet
      label: `B-${bug.id}`,
      preview: bug.title,
      found: false, // mark not-found since /bugs doesn't exist yet
    };
  }

  return { href: null, label: id, preview: null, found: false };
}

interface RefProps {
  /** Structured ID like "gad-68" or "R-v5.13" or a question/bug slug */
  id: string;
  /** Optional override label. Defaults to the canonical id form. */
  children?: React.ReactNode;
  /** Render as a compact chip with the id in a mono font (default). If false, renders inline. */
  chip?: boolean;
}

/**
 * Inline cross-reference to a structured planning entity. Renders as a clickable
 * chip (or inline underline) with a title tooltip showing the entity's title/preview.
 * Links to the entity's anchor on its index page.
 *
 * Usage:
 *   <Ref id="gad-68" />                   → compact chip "gad-68" linking to /decisions#gad-68
 *   <Ref id="gad-68" chip={false}>gad-68</Ref>
 */
export function Ref({ id, children, chip = true }: RefProps) {
  const resolved = resolveRef(id);
  const label = children ?? resolved.label;
  const title = resolved.preview ?? `Unresolved: ${id}`;

  if (chip) {
    const baseClass =
      "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors";
    const stateClass = resolved.found
      ? "border-accent/40 bg-accent/5 text-accent hover:bg-accent/15"
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
