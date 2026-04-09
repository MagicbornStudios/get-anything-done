// Game state management - follows state-composition skill
import type {
  GameState,
  PlayerState,
  Entity,
  CombatStats,
  ContentPacks,
  Spell,
  FloorData,
  RoomData,
} from "./types";

export function createPlayer(content: ContentPacks): PlayerState {
  const entityType = content.entities.entityTypes.human;
  const archetype = content.entities.archetypes.wanderer;

  const baseStats = { ...entityType.baseStats };
  // Apply archetype modifiers (state-composition skill)
  for (const [key, mod] of Object.entries(archetype.statModifiers)) {
    baseStats[key] = (baseStats[key] || 0) + (mod as number);
  }

  const combatStats: CombatStats = {
    maxHp: baseStats.maxHp,
    currentHp: baseStats.maxHp,
    maxMana: baseStats.maxMana,
    currentMana: baseStats.maxMana,
    might: baseStats.might,
    agility: baseStats.agility,
    insight: baseStats.insight || 10,
    willpower: baseStats.willpower || 8,
    defense: baseStats.defense,
    power: baseStats.power || 10,
  };

  // Deep copy starter spells
  const starterSpells: Spell[] = content.spells.starterSpells.map((s: Spell) => ({ ...s }));

  return {
    name: "Hero",
    level: 1,
    xp: 0,
    xpToNext: 30,
    combatStats,
    spells: starterSpells,
    spellSlots: 4,
    inventory: [
      { id: "minor_health_potion", name: "Minor Health Potion", description: "Restores 30 HP", type: "consumable", effect: { healHp: 30 }, icon: "health-potion", quantity: 2 },
    ],
    crystals: 10,
    runes: ["ignis"],  // start with one rune
    runeAffinity: { ignis: 1 },
    statusEffects: [],
    buffedStats: {},
    killCount: 0,
  };
}

export function createEnemy(
  room: RoomData,
  content: ContentPacks
): Entity {
  const enemyDef = room.enemy!;
  const entityType = content.entities.entityTypes[enemyDef.entityType];
  const archetype = content.entities.archetypes[enemyDef.archetype];

  if (!entityType || !archetype) {
    // Fallback enemy
    return {
      name: "Unknown Creature",
      entityType: enemyDef.entityType,
      archetype: enemyDef.archetype,
      level: enemyDef.level,
      combatStats: {
        maxHp: 30, currentHp: 30, maxMana: 10, currentMana: 10,
        might: 8, agility: 8, insight: 5, willpower: 5, defense: 5, power: 5,
      },
      isBoss: enemyDef.isBoss,
      resistances: room.resistances,
      reflectSpells: room.reflectSpells,
      manadrainAura: room.manadrainAura,
      statusEffects: [],
      buffedStats: {},
    };
  }

  const baseStats = { ...entityType.baseStats };
  for (const [key, mod] of Object.entries(archetype.statModifiers)) {
    baseStats[key] = (baseStats[key] || 0) + (mod as number);
  }

  // Scale by level
  const levelScale = 1 + (enemyDef.level - 1) * 0.15;
  for (const key of Object.keys(baseStats)) {
    baseStats[key] = Math.round(baseStats[key] * levelScale);
  }

  return {
    name: `${archetype.name} ${entityType.name}`,
    entityType: enemyDef.entityType,
    archetype: enemyDef.archetype,
    level: enemyDef.level,
    combatStats: {
      maxHp: baseStats.maxHp,
      currentHp: baseStats.maxHp,
      maxMana: baseStats.maxMana || 0,
      currentMana: baseStats.maxMana || 0,
      might: baseStats.might,
      agility: baseStats.agility || 8,
      insight: baseStats.insight || 5,
      willpower: baseStats.willpower || 5,
      defense: baseStats.defense,
      power: baseStats.power || 5,
    },
    isBoss: enemyDef.isBoss,
    resistances: room.resistances,
    reflectSpells: room.reflectSpells,
    manadrainAura: room.manadrainAura,
    statusEffects: [],
    buffedStats: {},
  };
}

export function createGameState(content: ContentPacks): GameState {
  const player = createPlayer(content);
  const firstFloor = content.floors.floors[0];
  const startRoom = firstFloor.rooms.find((r: RoomData) => r.feature === "start")!;

  const discovered = new Set<string>();
  discovered.add(startRoom.id);
  // Discover adjacent rooms
  for (const targetId of Object.values(startRoom.exits)) {
    discovered.add(targetId as string);
  }

  return {
    player,
    currentFloorIndex: 0,
    currentRoomId: startRoom.id,
    discoveredRooms: discovered,
    clearedRooms: new Set<string>(),
    dungeonTick: 0,
    gameOver: false,
    victory: false,
  };
}

export function getCurrentFloor(state: GameState, content: ContentPacks): FloorData {
  return content.floors.floors[state.currentFloorIndex];
}

export function getCurrentRoom(state: GameState, content: ContentPacks): RoomData {
  const floor = getCurrentFloor(state, content);
  return floor.rooms.find((r: RoomData) => r.id === state.currentRoomId)!;
}

// Save / Load
export function saveGame(state: GameState): void {
  const serializable = {
    ...state,
    discoveredRooms: Array.from(state.discoveredRooms),
    clearedRooms: Array.from(state.clearedRooms),
  };
  localStorage.setItem("escape-dungeon-save", JSON.stringify(serializable));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem("escape-dungeon-save");
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    data.discoveredRooms = new Set(data.discoveredRooms);
    data.clearedRooms = new Set(data.clearedRooms);
    if (!data.player.statusEffects) data.player.statusEffects = [];
    if (!data.player.buffedStats) data.player.buffedStats = {};
    return data;
  } catch {
    return null;
  }
}

export function gainXp(player: PlayerState, amount: number): string[] {
  const messages: string[] = [];
  player.xp += amount;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.round(player.xpToNext * 1.4);
    player.combatStats.maxHp += 10;
    player.combatStats.currentHp = Math.min(player.combatStats.currentHp + 10, player.combatStats.maxHp);
    player.combatStats.maxMana += 5;
    player.combatStats.currentMana = Math.min(player.combatStats.currentMana + 5, player.combatStats.maxMana);
    player.combatStats.might += 1;
    player.combatStats.power += 1;
    player.combatStats.defense += 1;
    messages.push(`Level up! You are now level ${player.level}!`);
  }
  return messages;
}
