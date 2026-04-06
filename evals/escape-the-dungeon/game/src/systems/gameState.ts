import type { GameState, PlayerState, SpellDefinition, EntityDefinition, Room, DungeonLevel, InventoryItem } from "../types";
import { DUNGEON } from "../content/dungeon";
import { ENTITIES } from "../content/entities";
import { AUTHORED_SPELLS, LEVEL_CURVE } from "../content/spells";
import { RUNES } from "../content/runes";

const SAVE_KEY = "escape_dungeon_save";

export function createInitialPlayerState(): PlayerState {
  const initialAffinities: Record<string, number> = {};
  RUNES.forEach((r) => {
    initialAffinities[r.runeId] = 0;
  });

  return {
    name: "Kael",
    entityTypeId: "human",
    occupationId: "dungeoneer",
    partyRoleId: "jack_of_all_trades",
    combatStats: {
      might: 10,
      agility: 10,
      insight: 10,
      willpower: 10,
      defense: 5,
      power: 8,
      currentHp: 50,
      maxHp: 50,
      currentMana: 30,
      maxMana: 30,
    },
    level: 1,
    xp: 0,
    xpToNext: LEVEL_CURVE[1] || 100,
    fame: 0,
    manaCrystals: 10,
    inventory: [
      { itemId: "item_health_potion", name: "Health Potion", kind: "consumable", quantity: 2, description: "Restores 20 HP." },
      { itemId: "item_mana_shard", name: "Mana Shard", kind: "consumable", quantity: 1, description: "Restores 15 mana." },
    ],
    spellPool: [AUTHORED_SPELLS[0], AUTHORED_SPELLS[5]], // Firebolt + Mend
    preparedSlots: [AUTHORED_SPELLS[0], AUTHORED_SPELLS[5], null, null], // 4 slots
    runeAffinities: initialAffinities,
    equippedTitleId: null,
    discoveredRooms: {},
    currentDungeonId: "dungeon_main",
    currentDepth: 1,
    currentRoomId: "r1_start",
    dungeonTick: 0,
    hasGoldenCrystal: false,
    deeds: [],
    mountSummoned: false,
  };
}

export function createGameState(): GameState {
  return {
    player: createInitialPlayerState(),
    activeEnemies: {},
    isInCombat: false,
    currentEnemy: null,
  };
}

let _gameState: GameState = createGameState();

export function getGameState(): GameState {
  return _gameState;
}

export function setGameState(state: GameState): void {
  _gameState = state;
}

export function resetGameState(): void {
  _gameState = createGameState();
}

// === Room/Dungeon helpers ===

export function getCurrentLevel(): DungeonLevel | undefined {
  return DUNGEON.levels.find((l) => l.depth === _gameState.player.currentDepth);
}

export function getCurrentRoom(): Room | undefined {
  const level = getCurrentLevel();
  return level?.rooms.find((r) => r.roomId === _gameState.player.currentRoomId);
}

export function getRoomById(depth: number, roomId: string): Room | undefined {
  const level = DUNGEON.levels.find((l) => l.depth === depth);
  return level?.rooms.find((r) => r.roomId === roomId);
}

export function getEntityById(entityId: string): EntityDefinition | undefined {
  return ENTITIES.find((e) => e.entityId === entityId);
}

export function discoverRoom(depth: number, roomId: string): void {
  if (!_gameState.player.discoveredRooms[depth]) {
    _gameState.player.discoveredRooms[depth] = [];
  }
  if (!_gameState.player.discoveredRooms[depth].includes(roomId)) {
    _gameState.player.discoveredRooms[depth].push(roomId);
  }
}

export function isRoomDiscovered(depth: number, roomId: string): boolean {
  return _gameState.player.discoveredRooms[depth]?.includes(roomId) ?? false;
}

// === Movement ===

export function moveToRoom(roomId: string): { room: Room; entities: EntityDefinition[] } | null {
  const level = getCurrentLevel();
  if (!level) return null;
  const room = level.rooms.find((r) => r.roomId === roomId);
  if (!room) return null;

  _gameState.player.currentRoomId = roomId;
  _gameState.player.dungeonTick += 1;
  discoverRoom(_gameState.player.currentDepth, roomId);

  // Get entities in room
  const entities = (room.entities || [])
    .map((eid) => getEntityById(eid))
    .filter((e): e is EntityDefinition => !!e);

  // Spawn check (boss spawns every 3 ticks)
  if (_gameState.player.dungeonTick % 3 === 0) {
    // Boss spawn logic simplified: add random enemy to a random room
    // (In full game this would use spawn tables)
  }

  return { room, entities };
}

export function moveToNextFloor(): boolean {
  const nextDepth = _gameState.player.currentDepth + 1;
  const nextLevel = DUNGEON.levels.find((l) => l.depth === nextDepth);
  if (!nextLevel) return false;

  _gameState.player.currentDepth = nextDepth;
  const startRoom = nextLevel.rooms.find((r) => r.feature === "stairs_down" || r.feature === "start");
  if (startRoom) {
    _gameState.player.currentRoomId = startRoom.roomId;
    discoverRoom(nextDepth, startRoom.roomId);
  }
  return true;
}

// === Combat ===

export function calculateDamage(attacker: { might: number; power: number }, defender: { defense: number }): number {
  const baseDmg = attacker.might + Math.floor(attacker.power * 0.5);
  const mitigated = Math.max(1, baseDmg - Math.floor(defender.defense * 0.5));
  // Add some variance
  const variance = Math.floor(Math.random() * 5) - 2;
  return Math.max(1, mitigated + variance);
}

export function calculateSpellDamage(caster: { power: number; insight: number }, spell: SpellDefinition): number {
  const baseDmg = spell.power + Math.floor(caster.power * 0.3) + Math.floor(caster.insight * 0.2);

  // Rune affinity bonus
  let affinityBonus = 0;
  for (const runeId of spell.runeCombo) {
    affinityBonus += Math.floor((_gameState.player.runeAffinities[runeId] || 0) / 10);
  }

  return Math.max(1, baseDmg + affinityBonus);
}

export function applySpellAffinityGain(spell: SpellDefinition): void {
  for (const runeId of spell.runeCombo) {
    const current = _gameState.player.runeAffinities[runeId] || 0;
    _gameState.player.runeAffinities[runeId] = Math.min(100, current + 2);
  }
}

// === XP / Leveling ===

export function addXP(amount: number): { leveledUp: boolean; newLevel: number } {
  _gameState.player.xp += amount;
  let leveledUp = false;

  while (
    _gameState.player.level < LEVEL_CURVE.length - 1 &&
    _gameState.player.xp >= LEVEL_CURVE[_gameState.player.level]
  ) {
    _gameState.player.level += 1;
    _gameState.player.combatStats.maxHp += 10;
    _gameState.player.combatStats.currentHp = Math.min(
      _gameState.player.combatStats.currentHp + 10,
      _gameState.player.combatStats.maxHp
    );
    _gameState.player.combatStats.maxMana += 5;
    _gameState.player.xpToNext = LEVEL_CURVE[_gameState.player.level] || 9999;
    leveledUp = true;
  }

  return { leveledUp, newLevel: _gameState.player.level };
}

// === Rest ===

export function restAtRoom(): void {
  _gameState.player.combatStats.currentHp = _gameState.player.combatStats.maxHp;
  _gameState.player.combatStats.currentMana = _gameState.player.combatStats.maxMana;
  _gameState.player.dungeonTick += 1;
}

// === Search / Treasure ===

export function searchRoom(): InventoryItem[] | null {
  const room = getCurrentRoom();
  if (!room || !room.treasureChestRef) return null;

  // Simple loot generation
  const crystals = 5 + Math.floor(Math.random() * 15) + (_gameState.player.currentDepth * 3);
  _gameState.player.manaCrystals += crystals;

  const loot: InventoryItem[] = [
    { itemId: "loot_crystals", name: "Mana Crystals", kind: "currency", quantity: crystals, description: `Found ${crystals} mana crystals.` },
  ];

  // Chance of item
  if (Math.random() < 0.4) {
    const potion: InventoryItem = { itemId: "item_health_potion", name: "Health Potion", kind: "consumable", quantity: 1, description: "Restores 20 HP." };
    const existing = _gameState.player.inventory.find((i) => i.itemId === potion.itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      _gameState.player.inventory.push(potion);
    }
    loot.push(potion);
  }

  // Remove chest so it can't be searched again
  room.treasureChestRef = undefined;

  return loot;
}

// === Crystal conversion ===

export function convertCrystalsToMana(amount: number): boolean {
  if (_gameState.player.manaCrystals < amount) return false;
  _gameState.player.manaCrystals -= amount;
  _gameState.player.combatStats.currentMana = Math.min(
    _gameState.player.combatStats.maxMana,
    _gameState.player.combatStats.currentMana + amount * 10
  );
  return true;
}

// === Use item ===

export function useItem(itemId: string): string | null {
  const item = _gameState.player.inventory.find((i) => i.itemId === itemId && i.quantity > 0);
  if (!item) return null;

  item.quantity -= 1;
  if (item.quantity <= 0) {
    _gameState.player.inventory = _gameState.player.inventory.filter((i) => i.itemId !== itemId || i.quantity > 0);
  }

  switch (itemId) {
    case "item_health_potion":
      _gameState.player.combatStats.currentHp = Math.min(
        _gameState.player.combatStats.maxHp,
        _gameState.player.combatStats.currentHp + 20
      );
      return "Restored 20 HP!";
    case "item_mana_shard":
      _gameState.player.combatStats.currentMana = Math.min(
        _gameState.player.combatStats.maxMana,
        _gameState.player.combatStats.currentMana + 15
      );
      return "Restored 15 mana!";
    default:
      return "Used " + item.name;
  }
}

// === Spell crafting ===

export function craftSpell(runeIds: string[]): SpellDefinition | null {
  if (runeIds.length < 1 || runeIds.length > 4) return null;
  if (_gameState.player.manaCrystals < 5) return null;

  _gameState.player.manaCrystals -= 5;

  // Calculate power from runes
  let totalPower = 0;
  for (const runeId of runeIds) {
    const rune = RUNES.find((r) => r.runeId === runeId);
    if (rune) totalPower += rune.basePower;
    // Affinity bonus
    totalPower += Math.floor((_gameState.player.runeAffinities[runeId] || 0) / 10);
  }

  const spell: SpellDefinition = {
    spellId: `custom_${Date.now()}`,
    name: runeIds.map((id) => RUNES.find((r) => r.runeId === id)?.symbol || "?").join(""),
    runeCombo: runeIds,
    manaCost: Math.max(5, Math.floor(totalPower * 0.6)),
    power: totalPower,
    categoryId: "combat",
    description: `Custom spell from runes: ${runeIds.map((id) => RUNES.find((r) => r.runeId === id)?.name).join(" + ")}`,
    effects: [{ effectId: "eff_custom_dmg", kind: "damage", value: totalPower, target: "enemy" }],
    isAuthored: false,
  };

  _gameState.player.spellPool.push(spell);
  return spell;
}

// === Save / Load ===

export function saveGame(): boolean {
  try {
    const data = JSON.stringify(_gameState);
    localStorage.setItem(SAVE_KEY, data);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): boolean {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return false;
    _gameState = JSON.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
