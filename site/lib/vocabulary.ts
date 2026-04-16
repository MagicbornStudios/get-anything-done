/** Canonical display vocabulary per decisions gad-166, gad-169, gad-189. */
export const VOCAB = {
  // Entity names
  evalProject: "Species",
  species: "Species",
  run: "Generation",
  version: "Generation",
  brood: "Brood",
  recipe: "Recipe",
  dna: "DNA",

  // Content types
  findings: "Articles",
  finding: "Article",

  // Banned terms (mapped to null — grep target for audit)
  emergentProduct: null, // Never use "emergent" as a product name
  gadEmergent: null, // Never use "GAD+emergent"

  // Section labels
  heroTitle: "Evolution Lab",
  planningTab: "Planning",
  evolutionTab: "Evolution",
  systemTab: "System",
  overviewTab: "Overview",
  marketplace: "Project Market",
} as const;

/** Get display name for an entity type. */
export function displayName(key: keyof typeof VOCAB): string | null {
  return VOCAB[key] ?? null;
}

/** Banned terms — use for grep audit in task 45-15. */
export const BANNED_TERMS = [
  "eval project",
  "eval-project",
  "GAD+emergent",
  "emergent", // as product name, not as workflow type
] as const;
