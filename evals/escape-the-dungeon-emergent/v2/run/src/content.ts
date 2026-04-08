// Content pack loading with fallback data
// Skill: content-pack-loading (inherited)

import type { ContentData, EntityType, Archetype, NPC, Floor, Rune, SpellRecipe, Item } from "./types";

// Fallback data so the game always works even if JSON fetch fails
const FALLBACK_ENTITIES: EntityType[] = [
  { id: "goblin", name: "Goblin", baseStats: { maxHp: 30, maxMana: 5, might: 8, agility: 12, defense: 4, power: 3, insight: 3, willpower: 2 }, description: "A sneaky creature.", color: "#4a9e4a", icon: "goblin" },
  { id: "skeleton", name: "Skeleton", baseStats: { maxHp: 45, maxMana: 0, might: 14, agility: 6, defense: 8, power: 2, insight: 1, willpower: 1 }, description: "Animated bones.", color: "#c9c9c9", icon: "skeleton" },
  { id: "dark_mage", name: "Dark Mage", baseStats: { maxHp: 25, maxMana: 30, might: 4, agility: 7, defense: 3, power: 16, insight: 14, willpower: 10 }, description: "Hooded spellcaster.", color: "#7b3fa0", icon: "mage" },
];

const FALLBACK_RUNES: Rune[] = [
  { id: "ignis", name: "Ignis", element: "fire", color: "#ff4422", icon: "flame", description: "Fire rune." },
  { id: "glacius", name: "Glacius", element: "ice", color: "#44aaff", icon: "snowflake", description: "Ice rune." },
  { id: "terra", name: "Terra", element: "earth", color: "#8b6914", icon: "mountain", description: "Earth rune." },
  { id: "vita", name: "Vita", element: "life", color: "#44ff66", icon: "heart", description: "Life rune." },
  { id: "ventus", name: "Ventus", element: "air", color: "#aaddff", icon: "wind", description: "Wind rune." },
];

let contentData: ContentData | null = null;

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const base = import.meta.env.BASE_URL;
    const resp = await fetch(`${base}${path}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function loadContent(): Promise<ContentData> {
  if (contentData) return contentData;

  const [entitiesData, floorsData, spellsData, itemsData] = await Promise.all([
    fetchJSON<{ entityTypes: EntityType[]; archetypes: Archetype[]; npcs: NPC[] }>("data/entities.json"),
    fetchJSON<{ floors: Floor[] }>("data/floors.json"),
    fetchJSON<{ runes: Rune[]; recipes: SpellRecipe[]; starterSpells: string[]; starterRunes: string[] }>("data/spells.json"),
    fetchJSON<{ items: Item[] }>("data/items.json"),
  ]);

  contentData = {
    entityTypes: entitiesData?.entityTypes ?? FALLBACK_ENTITIES,
    archetypes: entitiesData?.archetypes ?? [{ id: "wanderer", name: "Wanderer", statModifiers: { maxHp: 5 }, description: "Balanced." }],
    npcs: entitiesData?.npcs ?? [],
    floors: floorsData?.floors ?? [],
    runes: spellsData?.runes ?? FALLBACK_RUNES,
    recipes: spellsData?.recipes ?? [],
    starterSpells: spellsData?.starterSpells ?? [],
    starterRunes: spellsData?.starterRunes ?? ["ignis", "ignis", "glacius"],
    items: itemsData?.items ?? [],
  };

  return contentData;
}

export function getContent(): ContentData {
  if (!contentData) throw new Error("Content not loaded yet");
  return contentData;
}
