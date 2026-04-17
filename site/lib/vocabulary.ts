/**
 * Canonical display vocabulary — single source of truth for every user-facing term.
 *
 * Per decisions:
 *   gad-166: GAD is one condition. Drop "GAD+emergent" as a separate condition.
 *            Canonical matrix: GAD, GSD, bare, custom.
 *   gad-169: Findings are whitepapers/articles with per-slug pages.
 *   gad-189: Evolutionary vocabulary — Project, Recipe, Species, Generation,
 *            Brood, Bestiary, DNA — plus draft/published publication states.
 *   gad-219: Verb vocabulary — spawn / breed / evolve are distinct operations.
 *
 * Every user-facing component should import from this file. Task 45-15
 * (vocabulary audit) greps for BANNED_TERMS — add to that list, don't
 * duplicate strings at call sites.
 */

type Entity = Readonly<{
  singular: string;
  plural: string;
  /** "a" or "an" — picked once so copy is consistent. */
  article: "a" | "an";
}>;

const ENTITIES = {
  project: { singular: "Project", plural: "Projects", article: "a" },
  recipe: { singular: "Recipe", plural: "Recipes", article: "a" },
  species: { singular: "Species", plural: "Species", article: "a" },
  generation: { singular: "Generation", plural: "Generations", article: "a" },
  brood: { singular: "Brood", plural: "Broods", article: "a" },
  bestiary: { singular: "Bestiary", plural: "Bestiaries", article: "a" },
  dna: { singular: "DNA", plural: "DNA", article: "a" },
  finding: { singular: "Article", plural: "Articles", article: "an" },
} as const satisfies Record<string, Entity>;

export type EntityKey = keyof typeof ENTITIES;

export const VOCAB = {
  entities: ENTITIES,

  /** gad-166 experimental conditions. No "GAD+emergent" here by design. */
  conditions: {
    gad: "GAD",
    gsd: "GSD",
    bare: "Bare",
    custom: "Custom",
  },

  /** gad-189 publication states. Projects default to draft. */
  publication: {
    draft: "Draft",
    published: "Published",
  },

  /** UI sections. */
  sections: {
    heroTitle: "Evolution Lab",
    marketplace: "Project Market",
    findingsRoute: "Findings",
  },

  /** Project detail tabs (phase 45 wave 2). */
  tabs: {
    overview: "Overview",
    planning: "Planning",
    evolution: "Evolution",
    system: "System",
  },

  /** gad-219 evolutionary verbs — keep distinct, do not conflate. */
  verbs: {
    spawn: "Spawn",
    breed: "Breed",
    evolve: "Evolve",
    publish: "Publish",
    preserve: "Preserve",
  },

  /**
   * Legacy → canonical renames. Readers should map any surviving internal
   * term through this table before rendering user-facing copy.
   */
  renamed: {
    evalProject: "species",
    run: "generation",
    version: "generation",
    round: "generation",
  } satisfies Record<string, EntityKey>,
} as const;

/** Singular form for an entity. */
export function entityLabel(key: EntityKey): string {
  return ENTITIES[key].singular;
}

/** Pluralize an entity name based on count. */
export function pluralize(key: EntityKey, count: number): string {
  return count === 1 ? ENTITIES[key].singular : ENTITIES[key].plural;
}

/** Article + singular — e.g. `withArticle("finding")` → "an Article". */
export function withArticle(key: EntityKey): string {
  const e = ENTITIES[key];
  return `${e.article} ${e.singular}`;
}

/** Count + pluralized label — e.g. `countLabel("generation", 3)` → "3 Generations". */
export function countLabel(key: EntityKey, count: number): string {
  return `${count} ${pluralize(key, count)}`;
}

/** Resolve a legacy/internal key to its canonical entity key. */
export function canonicalizeLegacyKey(key: string): EntityKey | null {
  if (key in ENTITIES) return key as EntityKey;
  const renamed = (VOCAB.renamed as Record<string, EntityKey>)[key];
  return renamed ?? null;
}

/**
 * Terms that must never appear in user-facing copy. Audit target for task 45-15.
 *
 * NOTE: bare `"emergent"` is NOT banned — it remains a valid workflow descriptor
 * ("emergent-evolution working hypothesis", `workflow: "emergent"`). Only the
 * specific product framings below are banned.
 */
export const BANNED_TERMS = [
  "eval project",
  "eval-project",
  "eval_project",
  "GAD+emergent",
  "gad-emergent",
  "gad+emergent",
] as const;

export type BannedTerm = (typeof BANNED_TERMS)[number];
