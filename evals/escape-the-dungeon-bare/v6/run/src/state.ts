import { GameState, Player, Spell, PhysicalSkill, SkillTreeNode, ActionPolicy } from './types';
import { ALL_RUNES } from './data/runes';
import { createFloors } from './data/floors';

const SAVE_KEY = 'escape-dungeon-save';

function createStarterSpells(): Spell[] {
  return [
    {
      id: 'spell-basic-fire',
      name: 'Ember Spark',
      elements: ['fire'],
      runeIds: ['rune-fire'],
      damage: 10,
      manaCost: 5,
      affinity: 0,
      isCrafted: false,
    },
    {
      id: 'spell-basic-ice',
      name: 'Frost Shard',
      elements: ['ice'],
      runeIds: ['rune-ice'],
      damage: 10,
      manaCost: 5,
      affinity: 0,
      isCrafted: false,
    },
  ];
}

function createStarterSkills(): PhysicalSkill[] {
  return [
    {
      id: 'skill-slash',
      name: 'Slash',
      staminaCost: 5,
      damage: 8,
      level: 1,
      xpToNext: 20,
      currentXp: 0,
    },
    {
      id: 'skill-guard',
      name: 'Guard',
      staminaCost: 3,
      damage: 0,
      effect: { type: 'shield', value: 8, duration: 1 },
      level: 1,
      xpToNext: 20,
      currentXp: 0,
    },
  ];
}

function createSkillTree(): SkillTreeNode[] {
  return [
    { id: 'st-power-strike', name: 'Power Strike', description: 'A devastating blow. 15 damage, costs 8 stamina.', unlocked: false, skillId: 'skill-power-strike', cost: 1 },
    { id: 'st-whirlwind', name: 'Whirlwind', description: 'Hit all enemies for 10 damage. Costs 10 stamina.', unlocked: false, requires: ['st-power-strike'], skillId: 'skill-whirlwind', cost: 2 },
    { id: 'st-iron-wall', name: 'Iron Wall', description: 'Block 15 damage for 2 turns. Costs 6 stamina.', unlocked: false, skillId: 'skill-iron-wall', cost: 1 },
    { id: 'st-counter', name: 'Counter', description: 'Reflect 50% of next attack. Costs 7 stamina.', unlocked: false, requires: ['st-iron-wall'], skillId: 'skill-counter', cost: 2 },
    { id: 'st-drain-strike', name: 'Drain Strike', description: 'Deal 10 damage, heal 5 HP. Costs 8 stamina.', unlocked: false, requires: ['st-power-strike'], skillId: 'skill-drain-strike', cost: 2 },
    { id: 'st-focus', name: 'Focus', description: 'Next spell deals 50% more damage. Costs 5 stamina.', unlocked: false, skillId: 'skill-focus', cost: 1 },
  ];
}

function createDefaultPolicies(): ActionPolicy[] {
  return [
    { id: 'policy-heal-low', condition: 'HP < 30%', action: 'Use heal spell', priority: 1, enabled: true },
    { id: 'policy-weakness', condition: 'Enemy has weakness', action: 'Use element-matched spell', priority: 2, enabled: true },
    { id: 'policy-default', condition: 'Always', action: 'Use highest damage spell', priority: 5, enabled: true },
    { id: 'policy-guard-low', condition: 'HP < 20%', action: 'Use Guard skill', priority: 0, enabled: true },
    { id: 'policy-stamina-attack', condition: 'Mana < 10', action: 'Use physical skill', priority: 3, enabled: true },
  ];
}

export function createNewPlayer(): Player {
  const starterSpells = createStarterSpells();
  const starterSkills = createStarterSkills();
  return {
    name: 'Adventurer',
    hp: 80, maxHp: 80,
    mana: 30, maxMana: 30,
    stamina: 25, maxStamina: 25,
    level: 1,
    xp: 0, xpToNext: 50,
    gold: 20,
    attack: 5, defense: 3,
    traits: { aggression: 0.3, compassion: 0.4, arcaneAffinity: 0.3, cunning: 0.3, resilience: 0.4 },
    knownSpells: starterSpells,
    equippedSpells: [starterSpells[0], starterSpells[1], null, null, null, null],
    knownSkills: starterSkills,
    equippedSkills: [starterSkills[0], starterSkills[1], null, null],
    actionPolicies: createDefaultPolicies(),
    equipment: { 'main-hand': null, 'off-hand': null, 'body': null, 'trinket': null },
    inventory: [],
    discoveredRunes: ALL_RUNES.map(r => ({ ...r })),
    skillPoints: 0,
    skillTree: createSkillTree(),
    affinities: { fire: 5, ice: 5, lightning: 0, shadow: 0, nature: 0, arcane: 0 },
  };
}

export function createNewGameState(): GameState {
  const floors = createFloors();
  // Discover the first room
  floors[0].rooms[0].discovered = true;
  return {
    screen: 'exploration',
    player: createNewPlayer(),
    floors,
    currentFloor: 0,
    currentRoomId: 'f1-entrance',
    combatState: null,
    combatLog: [],
    gameTime: 0,
    gameStartTime: Date.now(),
    notifications: [],
    nextNotifId: 1,
    roomTransitions: 0,
    dialogueState: null,
    paused: false,
  };
}

// Save/Load with sanitization (strip functions from NPC dialogue)
export function saveGame(state: GameState): void {
  try {
    const serializable = JSON.parse(JSON.stringify(state, (key, value) => {
      if (typeof value === 'function') return undefined;
      return value;
    }));
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Rehydrate floor data with functions
    const freshFloors = createFloors();
    for (let fi = 0; fi < parsed.floors.length && fi < freshFloors.length; fi++) {
      const savedFloor = parsed.floors[fi];
      const freshFloor = freshFloors[fi];
      for (const freshRoom of freshFloor.rooms) {
        const savedRoom = savedFloor.rooms.find((r: any) => r.id === freshRoom.id);
        if (savedRoom) {
          // Restore functional data from fresh while keeping saved state
          if (freshRoom.eventData) savedRoom.eventData = freshRoom.eventData;
          if (freshRoom.npc) {
            const freshNpc = freshRoom.npc;
            if (savedRoom.npc) {
              freshNpc.met = savedRoom.npc.met;
            }
            savedRoom.npc = freshNpc;
          }
        }
      }
    }
    return parsed;
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

// Event-driven state management
type Listener = () => void;
let currentState: GameState | null = null;
const listeners: Set<Listener> = new Set();

export function getState(): GameState {
  return currentState!;
}

export function setState(newState: GameState): void {
  currentState = newState;
  notifyListeners();
}

export function updateState(updater: (state: GameState) => void): void {
  if (currentState) {
    updater(currentState);
    notifyListeners();
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}
