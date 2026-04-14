// Content pack loader - follows content-pack-loading skill
import type { ContentPacks } from "./types";

let cachedContent: ContentPacks | null = null;

export async function loadContent(): Promise<ContentPacks> {
  if (cachedContent) return cachedContent;

  const base = import.meta.env.BASE_URL;

  try {
    const [entities, floors, items, spells, dialogue] = await Promise.all([
      fetch(`${base}data/entities.json`).then((r) => {
        if (!r.ok) throw new Error(`entities.json: ${r.status}`);
        return r.json();
      }),
      fetch(`${base}data/floors.json`).then((r) => {
        if (!r.ok) throw new Error(`floors.json: ${r.status}`);
        return r.json();
      }),
      fetch(`${base}data/items.json`).then((r) => {
        if (!r.ok) throw new Error(`items.json: ${r.status}`);
        return r.json();
      }),
      fetch(`${base}data/spells.json`).then((r) => {
        if (!r.ok) throw new Error(`spells.json: ${r.status}`);
        return r.json();
      }),
      fetch(`${base}data/dialogue.json`).then((r) => {
        if (!r.ok) throw new Error(`dialogue.json: ${r.status}`);
        return r.json();
      }),
    ]);

    cachedContent = { entities, floors, items, spells, dialogue };
    return cachedContent;
  } catch (err) {
    console.error("Failed to load content packs:", err);
    // Return fallback
    return getFallbackContent();
  }
}

function getFallbackContent(): ContentPacks {
  return {
    entities: { entityTypes: {}, archetypes: {} },
    floors: { floors: [] },
    items: { items: {} },
    spells: { runes: {}, starterSpells: [], recipes: [] },
    dialogue: { npcs: {} },
  };
}
