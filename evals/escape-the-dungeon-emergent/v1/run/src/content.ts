import type { EntityType, Archetype, Floor, Spell, Item, DialogueNode } from "./types";

// Content pack loading (inherited skill: content-pack-loading)
// Uses import.meta.env.BASE_URL for correct paths in dev and production

interface ContentPacks {
  entities: { entityTypes: EntityType[]; archetypes: Archetype[] };
  floors: Floor[];
  spells: Spell[];
  items: Item[];
  dialogue: DialogueNode[];
}

let content: ContentPacks | null = null;

async function fetchJSON<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export const ContentManager = {
  async load() {
    const [entities, floors, spells, items, dialogue] = await Promise.all([
      fetchJSON<ContentPacks["entities"]>("entities.json"),
      fetchJSON<Floor[]>("floors.json"),
      fetchJSON<Spell[]>("spells.json"),
      fetchJSON<Item[]>("items.json"),
      fetchJSON<DialogueNode[]>("dialogue.json"),
    ]);
    content = { entities, floors, spells, items, dialogue };
  },

  getEntityType(id: string): EntityType | undefined {
    return content?.entities.entityTypes.find((e) => e.id === id);
  },

  getArchetype(id: string): Archetype | undefined {
    return content?.entities.archetypes.find((a) => a.id === id);
  },

  getFloor(id: string): Floor | undefined {
    return content?.floors.find((f) => f.id === id);
  },

  getRoom(floorId: string, roomId: string) {
    const floor = this.getFloor(floorId);
    return floor?.rooms.find((r) => r.id === roomId);
  },

  getSpell(id: string): Spell | undefined {
    return content?.spells.find((s) => s.id === id);
  },

  getItem(id: string): Item | undefined {
    return content?.items.find((i) => i.id === id);
  },

  getDialogue(id: string): DialogueNode | undefined {
    return content?.dialogue.find((d) => d.id === id);
  },

  getAllFloors(): Floor[] {
    return content?.floors ?? [];
  },

  getEnemyForRoom(room: { enemyId?: string }): EntityType | undefined {
    if (!room.enemyId) return undefined;
    return this.getEntityType(room.enemyId);
  },
};
