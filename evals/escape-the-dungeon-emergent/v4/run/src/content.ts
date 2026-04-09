import type { Floor, Rune, Spell, EnemyDef, GameEvent } from "./types";

export interface ContentData {
  floors: Floor[];
  runes: Rune[];
  starterSpells: Spell[];
  combinations: Spell[];
  enemies: Record<string, EnemyDef>;
  events: Record<string, GameEvent>;
}

async function loadJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL;
  const url = `${base}${path}`.replace(/\/+/g, "/");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadContent(): Promise<ContentData> {
  const [floorsRaw, runesRaw, spellsRaw, enemiesRaw] = await Promise.all([
    loadJson<{ floors: Floor[]; events: Record<string, GameEvent> }>("data/floors.json"),
    loadJson<{ runes: Rune[] }>("data/runes.json"),
    loadJson<{ starter: Spell[]; combinations: Spell[] }>("data/spells.json"),
    loadJson<{ enemies: Record<string, EnemyDef> }>("data/enemies.json"),
  ]);
  return {
    floors: floorsRaw.floors,
    events: floorsRaw.events,
    runes: runesRaw.runes,
    starterSpells: spellsRaw.starter,
    combinations: spellsRaw.combinations,
    enemies: enemiesRaw.enemies,
  };
}

export function findRoom(content: ContentData, floorIdx: number, roomId: string) {
  const floor = content.floors[floorIdx];
  if (!floor) return undefined;
  return floor.rooms.find((r) => r.id === roomId);
}
