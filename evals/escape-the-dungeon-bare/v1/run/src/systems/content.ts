import type {
  EntitiesData,
  FloorsData,
  ItemsData,
  SpellsData,
  DialoguesData,
} from "../types";

/** Singleton content store loaded from JSON packs. */
class ContentManager {
  entities!: EntitiesData;
  floors!: FloorsData;
  items!: ItemsData;
  spells!: SpellsData;
  dialogues!: DialoguesData;
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    const base = import.meta.env.BASE_URL ?? "./";
    const [entities, floors, items, spells, dialogues] = await Promise.all([
      fetch(`${base}data/entities.json`).then((r) => r.json()),
      fetch(`${base}data/floors.json`).then((r) => r.json()),
      fetch(`${base}data/items.json`).then((r) => r.json()),
      fetch(`${base}data/spells.json`).then((r) => r.json()),
      fetch(`${base}data/dialogue.json`).then((r) => r.json()),
    ]);
    this.entities = entities as EntitiesData;
    this.floors = floors as FloorsData;
    this.items = items as ItemsData;
    this.spells = spells as SpellsData;
    this.dialogues = dialogues as DialoguesData;
    this.loaded = true;
  }

  getEntityType(id: string) {
    return this.entities.entityTypes.find((e) => e.id === id);
  }

  getArchetype(id: string) {
    return this.entities.archetypes.find((a) => a.id === id);
  }

  getFloor(index: number) {
    return this.floors.floors[index];
  }

  getRoom(floorIndex: number, roomId: string) {
    const floor = this.getFloor(floorIndex);
    return floor?.rooms.find((r) => r.id === roomId);
  }

  getItem(id: string) {
    return this.items.items.find((i) => i.id === id);
  }

  getSpell(id: string) {
    return this.spells.spells.find((s) => s.id === id);
  }

  getDialogue(npcId: string) {
    return this.dialogues.dialogues[npcId];
  }
}

export const content = new ContentManager();
