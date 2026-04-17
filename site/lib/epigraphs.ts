/**
 * Art of War epigraph registry — Sun Tzu quotes mapped to site section
 * contexts, each with the original line and a codebase-evolutionary
 * adaptation. Task 45-05.
 *
 * Consumers: `<SectionEpigraph section="..."/>` (phase 45-16). Any site
 * section can drop a consistent epigraph header/divider by picking from
 * this registry. Section keys align with VOCAB.sections / VOCAB.tabs
 * (decision gad-189) plus a small set of whole-site contexts.
 *
 * Authoring rules:
 *   - `original` is verbatim Sun Tzu.
 *   - `adapted` rewrites the same line through our evolutionary/build vocabulary
 *     (species, generation, brood, agent, token, codebase, etc.).
 *   - Aim for 3+ entries per major section so rotation doesn't repeat within
 *     a single session view.
 */

export type EpigraphSection =
  | "hero"
  | "planning"
  | "evolution"
  | "system"
  | "findings"
  | "scoring"
  | "bestiary"
  | "marketplace";

export interface Epigraph {
  section: EpigraphSection;
  original: string;
  adapted: string;
  attribution: string;
}

const ATTRIBUTION = "Sun Tzu, The Art of War";

const epigraphs: readonly Epigraph[] = [
  // ---- hero ---------------------------------------------------------------
  {
    section: "hero",
    original:
      "Know your enemy and know yourself, and in a hundred battles you will never be defeated.",
    adapted:
      "Know your codebase and know your constraints, and in a hundred generations you will never be defeated.",
    attribution: ATTRIBUTION,
  },
  {
    section: "hero",
    original:
      "Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.",
    adapted:
      "Victorious species win first in planning, then spawn a generation; defeated species spawn a generation first, then scramble to score.",
    attribution: ATTRIBUTION,
  },
  {
    section: "hero",
    original: "Opportunities multiply as they are seized.",
    adapted:
      "Skills multiply as they are shed — each generation that drops a skill makes the next one possible.",
    attribution: ATTRIBUTION,
  },

  // ---- planning -----------------------------------------------------------
  {
    section: "planning",
    original: "Every battle is won before it is ever fought.",
    adapted:
      "Every generation is won before the first task is planned.",
    attribution: ATTRIBUTION,
  },
  {
    section: "planning",
    original:
      "The general who wins the battle makes many calculations in his temple before the battle is fought.",
    adapted:
      "The agent who wins the generation makes many decisions in its planning docs before the first commit is made.",
    attribution: ATTRIBUTION,
  },
  {
    section: "planning",
    original:
      "Appear weak when you are strong, and strong when you are weak.",
    adapted:
      "Appear vague when your requirements are crisp, and crisp when your requirements are vague — the gauges tell the truth either way.",
    attribution: ATTRIBUTION,
  },

  // ---- evolution ----------------------------------------------------------
  {
    section: "evolution",
    original: "In the midst of chaos, there is also opportunity.",
    adapted:
      "In the midst of failing builds, there is also mutation.",
    attribution: ATTRIBUTION,
  },
  {
    section: "evolution",
    original:
      "Water shapes its course according to the nature of the ground over which it flows.",
    adapted:
      "DNA shapes its expression according to the nature of the codebase over which it evolves.",
    attribution: ATTRIBUTION,
  },
  {
    section: "evolution",
    original:
      "He will win who knows when to fight and when not to fight.",
    adapted:
      "The species will win which knows when to breed and when to shed — not every mutation is progress.",
    attribution: ATTRIBUTION,
  },

  // ---- system -------------------------------------------------------------
  {
    section: "system",
    original:
      "Order or disorder depends on organisation; courage or cowardice on circumstances; strength or weakness on dispositions.",
    adapted:
      "Uptime or downtime depends on architecture; resilience or fragility on runtime dispositions; throughput or backpressure on queue shape.",
    attribution: ATTRIBUTION,
  },
  {
    section: "system",
    original:
      "There is no instance of a country having benefited from prolonged warfare.",
    adapted:
      "There is no instance of a project having benefited from a prolonged agent session — restart at clean boundaries.",
    attribution: ATTRIBUTION,
  },
  {
    section: "system",
    original:
      "Rapidity is the essence of war.",
    adapted:
      "Rapidity is the essence of iteration — tokens spent waiting are tokens lost.",
    attribution: ATTRIBUTION,
  },

  // ---- findings -----------------------------------------------------------
  {
    section: "findings",
    original:
      "What the ancients called a clever fighter is one who not only wins, but excels in winning with ease.",
    adapted:
      "What the ancients called a clever agent is one who not only ships, but excels in shipping with minimal token cost.",
    attribution: ATTRIBUTION,
  },
  {
    section: "findings",
    original: "The wise warrior avoids the battle.",
    adapted:
      "The wise builder avoids the feature — every unimplemented abstraction is a bug that cannot be written.",
    attribution: ATTRIBUTION,
  },
  {
    section: "findings",
    original:
      "All warfare is based on deception.",
    adapted:
      "All benchmarking is based on interpretation — a score without pressure context deceives the reader.",
    attribution: ATTRIBUTION,
  },

  // ---- scoring ------------------------------------------------------------
  {
    section: "scoring",
    original:
      "If you know the enemy and know yourself, your victory will not stand in doubt.",
    adapted:
      "If you measure the species and measure the environment, your eval score will not stand in doubt.",
    attribution: ATTRIBUTION,
  },
  {
    section: "scoring",
    original:
      "He who knows when he can fight and when he cannot, will be victorious.",
    adapted:
      "The gauge that knows when it is full and when it is empty will be believed — a number without a sweet-spot band is just a number.",
    attribution: ATTRIBUTION,
  },
  {
    section: "scoring",
    original:
      "The good fighter is able to secure himself against defeat, but the opportunity of defeating the enemy is provided by the enemy himself.",
    adapted:
      "The good framework secures itself against no-op runs, but the opportunity to distinguish species is provided by the pressure of the project itself.",
    attribution: ATTRIBUTION,
  },

  // ---- bestiary -----------------------------------------------------------
  {
    section: "bestiary",
    original:
      "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.",
    adapted:
      "Let your broods be deep and impenetrable as night, and when a generation spawns, fall like a thunderbolt of mutations.",
    attribution: ATTRIBUTION,
  },
  {
    section: "bestiary",
    original:
      "The clever combatant imposes his will on the enemy, but does not allow the enemy's will to be imposed on him.",
    adapted:
      "The clever species imposes its recipe on the project, but does not allow the project's drift to impose itself on the recipe.",
    attribution: ATTRIBUTION,
  },

  // ---- marketplace --------------------------------------------------------
  {
    section: "marketplace",
    original:
      "The supreme art of war is to subdue the enemy without fighting.",
    adapted:
      "The supreme art of distribution is to colonise the ecosystem without forking.",
    attribution: ATTRIBUTION,
  },
  {
    section: "marketplace",
    original:
      "Opportunities multiply as they are seized.",
    adapted:
      "Species multiply as they are published — a draft locked in the editor cannot breed.",
    attribution: ATTRIBUTION,
  },
];

/** All registered epigraphs, in insertion order. */
export function getAllEpigraphs(): Epigraph[] {
  return epigraphs.slice();
}

/** First epigraph matching `section`, or null. Kept for backwards compat. */
export function getEpigraph(section: EpigraphSection | string): Epigraph | null {
  return epigraphs.find((e) => e.section === section) ?? null;
}

/** All epigraphs for a given section (may be empty). */
export function getEpigraphsFor(section: EpigraphSection | string): Epigraph[] {
  return epigraphs.filter((e) => e.section === section);
}

/**
 * Deterministically pick one epigraph for a section using an optional seed.
 * Same seed → same pick. Useful when a page wants a stable epigraph per
 * session/build without repeatedly re-randomising across renders.
 */
export function pickEpigraph(
  section: EpigraphSection | string,
  seed?: number | string,
): Epigraph | null {
  const bucket = getEpigraphsFor(section);
  if (bucket.length === 0) return null;
  if (seed === undefined) return bucket[0];
  const idx = hashSeed(seed) % bucket.length;
  return bucket[idx];
}

/** Count of epigraphs per section — useful for rotation / coverage reporting. */
export function countBySection(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of epigraphs) {
    out[e.section] = (out[e.section] ?? 0) + 1;
  }
  return out;
}

/** Small stable hash for deterministic picks. Not cryptographic. */
function hashSeed(seed: number | string): number {
  if (typeof seed === "number") return Math.abs(Math.trunc(seed));
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
