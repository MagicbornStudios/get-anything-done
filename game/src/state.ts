// ============================================================
// Game state management — single source of truth
// ============================================================

import type { GameState, PlayerState, Floor, Item, Spell, PhysicalSkill, Rune } from './types';
import { bus, EVT } from './events';
import { createFloors, ALL_RUNES, STARTER_SPELLS, ALL_SKILLS, defaultTraits } from './data';

const SAVE_KEY = 'escape-dungeon-v11-save';

function createNewPlayer(): PlayerState {
  return {
    name: 'Hero',
    stats: {
      hp: 80, maxHp: 80,
      mana: 40, maxMana: 40,
      stamina: 30, maxStamina: 30,
      attack: 10, defense: 5, speed: 5,
      level: 1, xp: 0, xpToLevel: 50,
    },
    traits: defaultTraits(),
    runes: ALL_RUNES.map(r => ({ ...r, discovered: r.id === 'rune-fire' || r.id === 'rune-ice' })),
    spells: [...STARTER_SPELLS.map(s => ({ ...s }))],
    physicalSkills: ALL_SKILLS.map(s => ({ ...s })),
    spellLoadout: [STARTER_SPELLS[0], STARTER_SPELLS[1], null, null],
    skillLoadout: [ALL_SKILLS[0], ALL_SKILLS[1], null],
    actionPolicies: [
      { id: 'policy-heal', condition: 'hp_below_30', action: 'heal', priority: 1 },
      { id: 'policy-weakness', condition: 'enemy_has_weakness', action: 'exploit_weakness', priority: 3 },
      { id: 'policy-spell', condition: 'has_mana', action: 'use_spell', priority: 5 },
      { id: 'policy-skill', condition: 'has_stamina', action: 'use_skill', priority: 7 },
      { id: 'policy-attack', condition: 'always', action: 'attack', priority: 10 },
    ],
    inventory: [
      { id: 'item-hp-potion', name: 'Health Potion', category: 'consumable', icon: 'game-icons:health-potion', description: 'Restores 30 HP', quantity: 2, value: 15 },
      { id: 'item-mana-potion', name: 'Mana Potion', category: 'consumable', icon: 'game-icons:potion-ball', description: 'Restores 20 Mana', quantity: 1, value: 12 },
    ],
    equipment: { 'main-hand': null, 'off-hand': null, 'body': null, 'trinket': null },
    gold: 30,
    currentFloor: 1,
    currentRoomId: 'f1-entrance',
    questFlags: {},
    discoveredRunes: ['rune-fire', 'rune-ice'],
    gameClockStart: Date.now(),
  };
}

function createNewState(): GameState {
  return {
    player: createNewPlayer(),
    floors: createFloors(),
    started: false,
    gameOver: false,
    currentScene: 'title',
    toasts: [],
  };
}

let _state: GameState = createNewState();

export function getState(): GameState {
  return _state;
}

export function newGame(): void {
  _state = createNewState();
  _state.started = true;
  _state.currentScene = 'map';
  bus.emit(EVT.STATE_UPDATE, _state);
  bus.emit(EVT.SCENE_CHANGE, 'map');
  saveGame();
}

export function setScene(scene: string): void {
  _state.currentScene = scene;
  bus.emit(EVT.SCENE_CHANGE, scene);
}

export function getCurrentFloor(): Floor {
  return _state.floors.find(f => f.id === _state.player.currentFloor)!;
}

export function getCurrentRoom() {
  const floor = getCurrentFloor();
  return floor.rooms.find(r => r.id === _state.player.currentRoomId)!;
}

export function moveToRoom(roomId: string): void {
  const floor = getCurrentFloor();
  const room = floor.rooms.find(r => r.id === roomId);
  if (!room) return;

  // Discover connected rooms
  room.discovered = true;
  for (const connId of room.connections) {
    const conn = floor.rooms.find(r => r.id === connId);
    if (conn) conn.discovered = true;
  }

  _state.player.currentRoomId = roomId;
  bus.emit(EVT.ROOM_ENTER, room);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
  saveGame();
}

export function moveToFloor(floorId: number): void {
  _state.player.currentFloor = floorId;
  const floor = _state.floors.find(f => f.id === floorId)!;
  const entrance = floor.rooms[0];
  _state.player.currentRoomId = entrance.id;
  entrance.discovered = true;
  for (const connId of entrance.connections) {
    const conn = floor.rooms.find(r => r.id === connId);
    if (conn) conn.discovered = true;
  }
  bus.emit(EVT.FLOOR_CHANGE, floor);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
  saveGame();
}

export function addItem(item: Item): void {
  const existing = _state.player.inventory.find(i => i.id === item.id);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    _state.player.inventory.push({ ...item });
  }
  bus.emit(EVT.ITEM_GAINED, item);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
}

export function removeItem(itemId: string, qty: number = 1): boolean {
  const idx = _state.player.inventory.findIndex(i => i.id === itemId);
  if (idx === -1) return false;
  const item = _state.player.inventory[idx];
  item.quantity -= qty;
  if (item.quantity <= 0) _state.player.inventory.splice(idx, 1);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
  return true;
}

export function equipItem(item: Item): void {
  if (!item.equipSlot) return;
  const slot = item.equipSlot;
  const current = _state.player.equipment[slot];
  if (current) {
    // Unequip current — remove stat bonuses
    if (current.statBonuses) {
      for (const [key, val] of Object.entries(current.statBonuses)) {
        (_state.player.stats as any)[key] -= val!;
      }
    }
    addItem(current);
  }
  _state.player.equipment[slot] = { ...item };
  removeItem(item.id);
  if (item.statBonuses) {
    for (const [key, val] of Object.entries(item.statBonuses)) {
      (_state.player.stats as any)[key] += val!;
    }
  }
  bus.emit(EVT.EQUIP_CHANGE, _state.player.equipment);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
  saveGame();
}

export function discoverRune(runeId: string): void {
  const rune = _state.player.runes.find(r => r.id === runeId);
  if (rune && !rune.discovered) {
    rune.discovered = true;
    _state.player.discoveredRunes.push(runeId);
    bus.emit(EVT.RUNE_DISCOVERED, rune);
    showToast(`Rune discovered: ${rune.name}!`, 'loot');
    saveGame();
  }
}

export function addAffinity(runeId: string, amount: number): void {
  const rune = _state.player.runes.find(r => r.id === runeId);
  if (!rune || !rune.discovered) return;
  const oldLevel = rune.affinityLevel;
  rune.affinityLevel = Math.min(100, rune.affinityLevel + amount);

  // Check milestones
  for (const ms of rune.affinityMilestones) {
    if (!ms.claimed && rune.affinityLevel >= ms.level && oldLevel < ms.level) {
      ms.claimed = true;
      showToast(`${rune.name} milestone: ${ms.reward}`, 'loot');
    }
  }

  bus.emit(EVT.AFFINITY_CHANGE, { runeId, level: rune.affinityLevel, oldLevel });
}

export function shiftTrait(key: string, amount: number, source: string = ''): void {
  if (_state.player.traits[key] === undefined) return;
  const old = _state.player.traits[key];
  _state.player.traits[key] = Math.max(0, Math.min(1, old + amount));
  const change = _state.player.traits[key] - old;
  if (Math.abs(change) > 0.001) {
    bus.emit(EVT.TRAIT_SHIFT, { key, change, newValue: _state.player.traits[key], source });
    showToast(`${change > 0 ? '+' : ''}${change.toFixed(2)} ${key}`, 'trait');
  }
}

export function addGold(amount: number): void {
  _state.player.gold = Math.max(0, _state.player.gold + amount);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
}

export function addXP(amount: number): void {
  _state.player.stats.xp += amount;
  while (_state.player.stats.xp >= _state.player.stats.xpToLevel) {
    _state.player.stats.xp -= _state.player.stats.xpToLevel;
    _state.player.stats.level++;
    _state.player.stats.maxHp += 10;
    _state.player.stats.hp = _state.player.stats.maxHp;
    _state.player.stats.maxMana += 5;
    _state.player.stats.mana = _state.player.stats.maxMana;
    _state.player.stats.maxStamina += 3;
    _state.player.stats.stamina = _state.player.stats.maxStamina;
    _state.player.stats.attack += 2;
    _state.player.stats.defense += 1;
    _state.player.stats.xpToLevel = Math.floor(_state.player.stats.xpToLevel * 1.5);
    showToast(`Level up! Now level ${_state.player.stats.level}`, 'success');
  }
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
}

export function healPlayer(hp: number, mana: number = 0, stamina: number = 0): void {
  const s = _state.player.stats;
  s.hp = Math.min(s.maxHp, s.hp + hp);
  s.mana = Math.min(s.maxMana, s.mana + mana);
  s.stamina = Math.min(s.maxStamina, s.stamina + stamina);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
}

let toastId = 0;
export function showToast(text: string, type: string = 'info'): void {
  const toast = { id: ++toastId, text, type, timestamp: Date.now() };
  _state.toasts.push(toast);
  bus.emit(EVT.TOAST, toast);
  // Auto-remove after 4s
  setTimeout(() => {
    const idx = _state.toasts.findIndex(t => t.id === toast.id);
    if (idx !== -1) _state.toasts.splice(idx, 1);
  }, 4000);
}

export function addSpell(spell: Spell): void {
  _state.player.spells.push(spell);
  bus.emit(EVT.SPELL_CRAFTED, spell);
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
}

export function unlockSkill(skillId: string): boolean {
  const skill = _state.player.physicalSkills.find(s => s.id === skillId);
  if (!skill || skill.unlocked) return false;
  // Check prerequisites
  for (const prereq of skill.prerequisites) {
    const p = _state.player.physicalSkills.find(s => s.id === prereq);
    if (!p || !p.unlocked) return false;
  }
  skill.unlocked = true;
  showToast(`Skill unlocked: ${skill.name}!`, 'success');
  bus.emit(EVT.PLAYER_UPDATE, _state.player);
  return true;
}

// ---- Save / Load ----
export function saveGame(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_state));
  } catch (e) { /* ignore */ }
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as GameState;
    if (!saved.started) return false;
    _state = saved;
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return saved.started === true;
  } catch {
    return false;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function getGameClock(): { hours: number; minutes: number; dayNight: string } {
  const elapsed = Date.now() - _state.player.gameClockStart;
  // 1 real minute = 1 in-game hour
  const totalMinutes = Math.floor(elapsed / 60000);
  const hours = totalMinutes % 24;
  const minutes = Math.floor((elapsed % 60000) / 1000);
  const dayNight = hours >= 6 && hours < 18 ? 'day' : 'night';
  return { hours, minutes, dayNight };
}
