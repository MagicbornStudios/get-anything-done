import type { Enemy, NPC, Spell, Rune, SpellRecipe, Room, InventoryItem } from "../types";
import enemiesData from "../data/enemies.json";
import floorsData from "../data/floors.json";
import itemsData from "../data/items.json";
import spellsData from "../data/spells.json";
import runesData from "../data/runes.json";
import recipesData from "../data/recipes.json";
import npcsData from "../data/npcs.json";

// Content pack loader - all game data from JSON, not hardcoded
export class DataLoader {
  private enemies: Map<string, Enemy> = new Map();
  private rooms: Map<string, Room> = new Map();
  private items: Map<string, InventoryItem> = new Map();
  private spells: Map<string, Spell> = new Map();
  private runes: Map<string, Rune> = new Map();
  private recipes: SpellRecipe[] = [];
  private npcs: Map<string, NPC> = new Map();

  load(): void {
    for (const e of enemiesData as unknown as Enemy[]) {
      this.enemies.set(e.id, e);
    }
    for (const floor of floorsData as unknown as { floor: number; rooms: Room[] }[]) {
      for (const r of floor.rooms) {
        this.rooms.set(r.id, r);
      }
    }
    for (const i of itemsData as unknown as InventoryItem[]) {
      this.items.set(i.id, i);
    }
    for (const s of spellsData as unknown as Spell[]) {
      this.spells.set(s.id, s);
    }
    for (const r of runesData as unknown as Rune[]) {
      this.runes.set(r.id, r);
    }
    this.recipes = recipesData as unknown as SpellRecipe[];
    for (const n of npcsData as unknown as NPC[]) {
      this.npcs.set(n.id, n);
    }
  }

  getEnemy(id: string): Enemy | undefined {
    const e = this.enemies.get(id);
    if (!e) return undefined;
    // Return a deep copy so combat doesn't mutate the template
    return JSON.parse(JSON.stringify(e));
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getRoomsForFloor(floor: number): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.floor === floor);
  }

  getItem(id: string): InventoryItem | undefined {
    const i = this.items.get(id);
    if (!i) return undefined;
    return JSON.parse(JSON.stringify(i));
  }

  getSpell(id: string): Spell | undefined {
    return this.spells.get(id);
  }

  getAllSpells(): Spell[] {
    return Array.from(this.spells.values());
  }

  getRune(id: string): Rune | undefined {
    return this.runes.get(id);
  }

  getAllRunes(): Rune[] {
    return Array.from(this.runes.values());
  }

  getRecipes(): SpellRecipe[] {
    return this.recipes;
  }

  findRecipe(rune1: string, rune2: string): SpellRecipe | undefined {
    return this.recipes.find(
      r => (r.rune1 === rune1 && r.rune2 === rune2) || (r.rune1 === rune2 && r.rune2 === rune1)
    );
  }

  getNPC(id: string): NPC | undefined {
    return this.npcs.get(id);
  }
}
