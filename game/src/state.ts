// ============================================================
// Game state manager — single source of truth
// ============================================================

import type { GameState, PlayerState, Item, Spell, Rune, PhysicalSkill } from './types';
import { createFloors, ALL_RUNES, STARTER_SPELLS, ALL_SKILLS, DEFAULT_POLICIES, defaultTraits } from './data';
import { emit } from './events';

const SAVE_KEY = 'escape-dungeon-v12-save';

let state: GameState | null = null;

function createInitialPlayer(): PlayerState {
  return {
    name: 'Adventurer',
    stats: { hp: 80, maxHp: 80, mana: 40, maxMana: 40, stamina: 30, maxStamina: 30, attack: 8, defense: 5, speed: 5, level: 1, xp: 0, xpToLevel: 50 },
    traits: defaultTraits(),
    runes: ALL_RUNES.map(r => ({ ...r, affinityMilestones: r.affinityMilestones.map(m => ({ ...m })) })),
    spells: STARTER_SPELLS.map(s => ({ ...s, effects: s.effects.map(e => ({ ...e })) })),
    physicalSkills: ALL_SKILLS.map(s => ({ ...s, effects: s.effects.map(e => ({ ...e })) })),
    spellLoadout: [STARTER_SPELLS[0].id, STARTER_SPELLS[1].id, null, null],
    skillLoadout: [ALL_SKILLS[0].id, ALL_SKILLS[1].id, null],
    actionPolicies: DEFAULT_POLICIES.map(p => ({ ...p })),
    inventory: [
      { id: 'item-health-potion', name: 'Health Potion', category: 'consumable', icon: 'game-icons:health-potion', description: 'Restores 30 HP', quantity: 2, value: 15 },
      { id: 'item-mana-potion', name: 'Mana Potion', category: 'consumable', icon: 'game-icons:potion-ball', description: 'Restores 20 Mana', quantity: 1, value: 12 },
    ],
    equipment: { 'main-hand': null, 'off-hand': null, 'body': null, 'trinket': null },
    gold: 30,
    currentFloor: 1,
    currentRoomId: 'f1-entrance',
    questFlags: {},
    discoveredRunes: ['rune-ember', 'rune-frost'],
    gameClockStart: Date.now(),
  };
}

export function newGame(): GameState {
  state = {
    player: createInitialPlayer(),
    floors: createFloors(),
    started: true,
    gameOver: false,
    victory: false,
    currentScene: 'map',
    combatLog: [],
    combatPaused: false,
    combatActive: false,
  };
  saveGame();
  return state;
}

export function getState(): GameState {
  if (!state) throw new Error('Game not initialized');
  return state;
}

export function setState(s: GameState): void {
  state = s;
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(): void {
  if (!state) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    state = JSON.parse(raw) as GameState;
    return state;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

// ---- PLAYER HELPERS ----

export function getCurrentFloor() {
  const s = getState();
  return s.floors.find(f => f.id === s.player.currentFloor)!;
}

export function getCurrentRoom() {
  const floor = getCurrentFloor();
  return floor.rooms.find(r => r.id === getState().player.currentRoomId)!;
}

export function getEquippedSpells(): Spell[] {
  const s = getState();
  return s.player.spellLoadout
    .filter((id): id is string => id !== null)
    .map(id => s.player.spells.find(sp => sp.id === id))
    .filter((sp): sp is Spell => sp !== undefined);
}

export function getEquippedSkills(): PhysicalSkill[] {
  const s = getState();
  return s.player.skillLoadout
    .filter((id): id is string => id !== null)
    .map(id => s.player.physicalSkills.find(sk => sk.id === id))
    .filter((sk): sk is PhysicalSkill => sk !== undefined);
}

export function addItem(item: Item): void {
  const s = getState();
  const existing = s.player.inventory.find(i => i.id === item.id);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    s.player.inventory.push({ ...item });
  }
  emit('state-changed');
}

export function removeItem(itemId: string, qty = 1): boolean {
  const s = getState();
  const item = s.player.inventory.find(i => i.id === itemId);
  if (!item || item.quantity < qty) return false;
  item.quantity -= qty;
  if (item.quantity <= 0) {
    s.player.inventory = s.player.inventory.filter(i => i.id !== itemId);
  }
  emit('state-changed');
  return true;
}

export function discoverRune(runeId: string): void {
  const s = getState();
  if (s.player.discoveredRunes.includes(runeId)) return;
  s.player.discoveredRunes.push(runeId);
  const rune = s.player.runes.find(r => r.id === runeId);
  if (rune) {
    rune.discovered = true;
    emit('toast', `Discovered: ${rune.name}!`, 'success');
  }
  emit('state-changed');
}

export function shiftTrait(trait: string, delta: number): void {
  const s = getState();
  if (s.player.traits[trait] !== undefined) {
    s.player.traits[trait] = Math.max(0, Math.min(1, s.player.traits[trait] + delta));
    emit('trait-shift', trait, delta);
    emit('state-changed');
  }
}

export function gainXP(amount: number): void {
  const s = getState();
  s.player.stats.xp += amount;
  while (s.player.stats.xp >= s.player.stats.xpToLevel) {
    s.player.stats.xp -= s.player.stats.xpToLevel;
    s.player.stats.level++;
    s.player.stats.maxHp += 10;
    s.player.stats.hp = s.player.stats.maxHp;
    s.player.stats.maxMana += 5;
    s.player.stats.mana = s.player.stats.maxMana;
    s.player.stats.maxStamina += 3;
    s.player.stats.stamina = s.player.stats.maxStamina;
    s.player.stats.attack += 2;
    s.player.stats.defense += 1;
    s.player.stats.speed += 1;
    s.player.stats.xpToLevel = Math.floor(s.player.stats.xpToLevel * 1.5);
    emit('toast', `Level Up! Now level ${s.player.stats.level}`, 'success');

    // Unlock skills based on level
    for (const skill of s.player.physicalSkills) {
      if (!skill.unlocked && skill.tier <= s.player.stats.level) {
        const prereqsMet = skill.prerequisites.every(pid =>
          s.player.physicalSkills.find(ps => ps.id === pid)?.unlocked
        );
        if (prereqsMet) {
          skill.unlocked = true;
          emit('toast', `Skill Unlocked: ${skill.name}!`, 'success');
        }
      }
    }
  }
  emit('state-changed');
}

export function gainAffinityFromCasting(spell: Spell, amount = 3): void {
  const s = getState();
  for (const runeId of spell.runeIds) {
    const rune = s.player.runes.find(r => r.id === runeId);
    if (rune && rune.discovered) {
      rune.affinityLevel = Math.min(100, rune.affinityLevel + amount);
      // Check milestones (R-v5.16)
      for (const ms of rune.affinityMilestones) {
        if (!ms.claimed && rune.affinityLevel >= ms.level) {
          ms.claimed = true;
          emit('toast', `${rune.name} Affinity ${ms.level}: ${ms.reward}`, 'success');
        }
      }
    }
  }
  emit('state-changed');
}

export function getEffectiveStats() {
  const s = getState();
  const base = { ...s.player.stats };
  // Apply equipment bonuses
  for (const slot of Object.values(s.player.equipment)) {
    if (slot?.statBonuses) {
      for (const [key, val] of Object.entries(slot.statBonuses)) {
        if (val && key in base) {
          (base as any)[key] += val;
        }
      }
    }
  }
  // Apply affinity bonuses
  for (const rune of s.player.runes) {
    if (rune.discovered && rune.affinityLevel >= 25) {
      // Affinity milestone 1: +20% power for that element handled in combat
    }
  }
  return base;
}
