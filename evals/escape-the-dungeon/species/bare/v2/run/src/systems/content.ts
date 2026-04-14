import type { EntityType, EnemyDef, FloorDef, SpellDef, ItemDef, NpcDef } from "../types";

import entitiesData from "../data/entities.json";
import floorsData from "../data/floors.json";
import spellsData from "../data/spells.json";
import itemsData from "../data/items.json";
import dialogueData from "../data/dialogue.json";

// Content pack singleton - all game data loaded from JSON
class ContentManager {
  entityTypes: EntityType[];
  enemies: EnemyDef[];
  floors: FloorDef[];
  spells: SpellDef[];
  items: ItemDef[];
  npcs: Record<string, NpcDef>;

  constructor() {
    this.entityTypes = entitiesData.entityTypes as unknown as EntityType[];
    this.enemies = entitiesData.enemies as unknown as EnemyDef[];
    this.floors = floorsData.floors as unknown as FloorDef[];
    this.spells = spellsData.spells as unknown as SpellDef[];
    this.items = itemsData.items as unknown as ItemDef[];
    this.npcs = dialogueData.npcs as unknown as Record<string, NpcDef>;
  }

  getEnemy(id: string): EnemyDef | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  getFloor(index: number): FloorDef | undefined {
    return this.floors[index];
  }

  getRoom(floorIndex: number, roomId: string) {
    const floor = this.floors[floorIndex];
    if (!floor) return undefined;
    return floor.rooms.find((r) => r.id === roomId);
  }

  getSpell(id: string): SpellDef | undefined {
    return this.spells.find((s) => s.id === id);
  }

  getItem(id: string): ItemDef | undefined {
    return this.items.find((i) => i.id === id);
  }

  getNpc(id: string): NpcDef | undefined {
    return this.npcs[id];
  }

  getEntityType(id: string): EntityType | undefined {
    return this.entityTypes.find((e) => e.id === id);
  }
}

export const content = new ContentManager();
