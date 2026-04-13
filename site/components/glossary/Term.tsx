import { GLOSSARY, type GlossaryTerm } from "@/lib/eval-data";

/**
 * Build a case-insensitive lookup from term id + display name + aliases to the GlossaryTerm record.
 * Computed once at module load.
 */
const TERM_INDEX: Map<string, GlossaryTerm> = (() => {
  const m = new Map<string, GlossaryTerm>();
  for (const t of GLOSSARY) {
    m.set(t.id.toLowerCase(), t);
    m.set(t.term.toLowerCase(), t);
    for (const alias of t.aliases) {
      m.set(alias.toLowerCase(), t);
    }
  }
  return m;
})();

function resolveTerm(key: string): GlossaryTerm | null {
  return TERM_INDEX.get(key.toLowerCase()) ?? null;
}

interface TermProps {
  /** Glossary id, display name, or alias — matched case-insensitively. */
  id: string;
  /** Optional override label. Defaults to the glossary term's display name. */
  children?: React.ReactNode;
  /** Set to true to render as plain inline text if the term isn't in the glossary. Default: true. */
  fallbackToPlain?: boolean;
}

/**
 * Inline tooltip wrapper for a glossary term. Uses native <abbr title> for
 * accessibility + hover tooltip, then links to the /glossary anchor for
 * the full definition. Works in server components — no client JS.
 *
 * Usage:
 *   <Term id="CSH">CSH</Term>
 *   <Term id="freedom-hypothesis" />
 */
export function Term({ id, children, fallbackToPlain = true }: TermProps) {
  const term = resolveTerm(id);

  if (!term) {
    if (fallbackToPlain) return <>{children ?? id}</>;
    return (
      <span className="text-rose-400" title={`Unknown glossary term: ${id}`}>
        {children ?? id}
      </span>
    );
  }

  const label = children ?? term.term;

  return (
    <abbr
      title={term.short}
      className="inline cursor-help underline decoration-dotted decoration-accent/60 underline-offset-2 transition-colors hover:decoration-accent hover:text-accent"
      style={{ textDecoration: "underline dotted" }}
    >
      {label}
    </abbr>
  );
}

/**
 * Returns every alias + display name known to the glossary, so callers can
 * auto-detect terms in free text if they want to.
 */
export function allTermKeys(): string[] {
  return [...TERM_INDEX.keys()];
}
