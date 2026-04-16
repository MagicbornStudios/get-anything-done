/**
 * Art of War epigraph registry — Sun Tzu quotes mapped to site sections,
 * with evolutionary/codebase-adapted variants.
 */

export interface Epigraph {
  section: string;
  original: string;
  adapted: string;
  attribution: string;
}

const ATTRIBUTION = "Sun Tzu, The Art of War";

const epigraphs: Epigraph[] = [
  {
    section: "hero",
    original:
      "Know your enemy and know yourself, and in a hundred battles you will never be defeated.",
    adapted:
      "Know your codebase and know your constraints — in a hundred generations, you will never be defeated.",
    attribution: ATTRIBUTION,
  },
  {
    section: "planning",
    original: "Every battle is won before it is ever fought.",
    adapted:
      "Every generation is won before the first task is planned.",
    attribution: ATTRIBUTION,
  },
  {
    section: "evolution",
    original: "In the midst of chaos, there is also opportunity.",
    adapted:
      "In the midst of failing builds, there is also mutation.",
    attribution: ATTRIBUTION,
  },
  {
    section: "system",
    original:
      "Order or disorder depends on organisation; courage or cowardice on circumstances; strength or weakness on dispositions.",
    adapted:
      "Uptime or downtime depends on architecture; resilience or fragility on runtime dispositions.",
    attribution: ATTRIBUTION,
  },
  {
    section: "findings",
    original:
      "What the ancients called a clever fighter is one who not only wins, but excels in winning with ease.",
    adapted:
      "What the ancients called a clever agent is one who not only ships, but excels in shipping with minimal token cost.",
    attribution: ATTRIBUTION,
  },
  {
    section: "scoring",
    original:
      "If you know the enemy and know yourself, your victory will not stand in doubt.",
    adapted:
      "If you measure the species and measure the environment, your eval score will not stand in doubt.",
    attribution: ATTRIBUTION,
  },
  {
    section: "bestiary",
    original:
      "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.",
    adapted:
      "Let your broods be deep and impenetrable as night, and when they spawn, fall like a thunderbolt of mutations.",
    attribution: ATTRIBUTION,
  },
  {
    section: "marketplace",
    original:
      "The supreme art of war is to subdue the enemy without fighting.",
    adapted:
      "The supreme art of distribution is to colonise the ecosystem without forking.",
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
    section: "planning",
    original:
      "The general who wins the battle makes many calculations in his temple before the battle is fought.",
    adapted:
      "The agent who wins the generation makes many calculations in its planning docs before the first commit is made.",
    attribution: ATTRIBUTION,
  },
];

/**
 * Return the first epigraph matching the given section, or null.
 */
export function getEpigraph(section: string): Epigraph | null {
  return epigraphs.find((e) => e.section === section) ?? null;
}

/**
 * Return all registered epigraphs.
 */
export function getAllEpigraphs(): Epigraph[] {
  return [...epigraphs];
}
