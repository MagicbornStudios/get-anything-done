import type { GameState, FloorData, RuneData, RecipeData, SpellData, SkillTreeNode, CombatPolicy } from './types';

const SAVE_KEY = 'escape-dungeon-save-v5';

export function createDefaultPolicy(): CombatPolicy {
  return {
    lowHpThreshold: 30,
    preferDot: true,
    useForgeSpells: true,
    conserveMana: false,
  };
}

export function createNewGame(
  floors: FloorData[],
  runes: RuneData[],
  recipes: RecipeData[],
  starterSpells: SpellData[],
  skillTree: SkillTreeNode[]
): GameState {
  const state: GameState = {
    view: 'game',
    currentFloorId: 'f1',
    currentRoomId: 'f1_entry',
    player: {
      name: 'Adventurer',
      level: 1,
      xp: 0,
      xpToNext: 50,
      hp: 80,
      maxHp: 80,
      mana: 40,
      maxMana: 40,
      attack: 10,
      defense: 5,
      spellPower: 8,
      gold: 30,
      traits: {
        aggression: 0.3,
        compassion: 0.5,
        cunning: 0.3,
      },
      inventory: [],
      equipment: {
        weapon: null,
        offhand: null,
        accessory: null,
      },
      spells: starterSpells.map(s => ({ ...s, affinityUses: 0 })),
      runes: [
        { id: 'rune_fire', name: 'Fire Rune', type: 'rune', icon: 'game-icons:fire-ring', element: 'fire' },
        { id: 'rune_blood', name: 'Blood Rune', type: 'rune', icon: 'game-icons:drop', element: 'blood' },
      ],
      discoveredRecipes: [],
      craftedSpellUsedOnFloor: {},
      skillPoints: 1,
      unlockedSkills: [],
      loadout: {
        spellSlots: [starterSpells[0]?.id || null, starterSpells[1]?.id || null, null, null],
      },
      combatPolicy: createDefaultPolicy(),
      affinities: {},
    },
    clearedRooms: [],
    visitedRooms: ['f1_entry'],
    dialogueChoicesMade: {},
    combat: null,
    floorsData: floors,
    runesData: runes,
    recipesData: recipes,
    skillTreeData: skillTree,
    starterSpells,
    turnsElapsed: 0,
    hungerLevel: 0,
  };
  return state;
}

export function saveGame(state: GameState): void {
  try {
    const serializable = { ...state, combat: null };
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
  } catch (e) {
    console.warn('Failed to save game:', e);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch (e) {
    console.warn('Failed to load game:', e);
    return null;
  }
}

export function hasSave(): boolean {
  return !!localStorage.getItem(SAVE_KEY);
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function getCurrentFloor(state: GameState): FloorData | undefined {
  return state.floorsData.find(f => f.id === state.currentFloorId);
}

export function getCurrentRoom(state: GameState) {
  const floor = getCurrentFloor(state);
  return floor?.rooms.find(r => r.id === state.currentRoomId);
}

export function getEquipmentBonuses(state: GameState): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const slot of Object.values(state.player.equipment)) {
    if (slot?.stats) {
      for (const [k, v] of Object.entries(slot.stats)) {
        bonuses[k] = (bonuses[k] || 0) + v;
      }
    }
  }
  return bonuses;
}

export function getEffectiveStats(state: GameState) {
  const equip = getEquipmentBonuses(state);
  const skillBonuses: Record<string, number> = {};
  for (const skillId of state.player.unlockedSkills) {
    const node = state.skillTreeData.find(n => n.id === skillId);
    if (node) {
      for (const [k, v] of Object.entries(node.effect)) {
        skillBonuses[k] = (skillBonuses[k] || 0) + v;
      }
    }
  }

  const hungerPenalty = Math.floor(state.hungerLevel / 20);

  return {
    maxHp: state.player.maxHp + (equip.maxHp || 0) + (skillBonuses.maxHp || 0),
    maxMana: state.player.maxMana + (equip.maxMana || 0) + (skillBonuses.maxMana || 0),
    attack: Math.max(1, state.player.attack + (equip.attack || 0) + (skillBonuses.attack || 0) - hungerPenalty),
    defense: Math.max(0, state.player.defense + (equip.defense || 0) + (skillBonuses.defense || 0) - hungerPenalty),
    spellPower: Math.max(1, state.player.spellPower + (equip.spellPower || 0) + (skillBonuses.spellPower || 0)),
    craftedManaCostReduction: skillBonuses.craftedManaCostReduction || 0,
  };
}

export function checkLevelUp(state: GameState): boolean {
  if (state.player.xp >= state.player.xpToNext) {
    state.player.xp -= state.player.xpToNext;
    state.player.level++;
    state.player.xpToNext = Math.floor(state.player.xpToNext * 1.5);
    state.player.maxHp += 8;
    state.player.maxMana += 5;
    state.player.hp = state.player.maxHp;
    state.player.mana = state.player.maxMana;
    state.player.attack += 2;
    state.player.defense += 1;
    state.player.spellPower += 1;
    state.player.skillPoints += 1;
    return true;
  }
  return false;
}
