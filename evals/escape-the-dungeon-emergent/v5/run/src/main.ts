import 'iconify-icon';
import { createNewGame, loadGame, hasSave, clearSave } from './state';
import { UI } from './ui';
import type { FloorData, RuneData, RecipeData, SpellData, SkillTreeNode } from './types';

const BASE = import.meta.env.BASE_URL;

interface GameData {
  floors: FloorData[];
  runes: RuneData[];
  recipes: RecipeData[];
  starterSpells: SpellData[];
  skillTree: SkillTreeNode[];
}

async function loadGameData(): Promise<GameData> {
  try {
    const resp = await fetch(`${BASE}data/floors.json`);
    if (!resp.ok) throw new Error(`Failed to load game data: ${resp.status}`);
    const data = await resp.json();
    return {
      floors: data.floors,
      runes: data.runes,
      recipes: data.recipes,
      starterSpells: data.starterSpells,
      skillTree: data.skillTree,
    };
  } catch (e) {
    console.error('Failed to load game data, using fallback:', e);
    // Minimal fallback so the game always shows something
    return {
      floors: [],
      runes: [],
      recipes: [],
      starterSpells: [],
      skillTree: [],
    };
  }
}

async function main() {
  const root = document.getElementById('app');
  if (!root) return;

  const gameData = await loadGameData();
  const ui = new UI(root);

  function startNewGame() {
    clearSave();
    const state = createNewGame(
      gameData.floors,
      gameData.runes,
      gameData.recipes,
      gameData.starterSpells,
      gameData.skillTree,
    );
    ui.setState(state, () => startNewGame());
  }

  // Check for saved game
  const saved = loadGame();
  if (saved) {
    // Re-inject static data references that aren't saved
    saved.floorsData = gameData.floors;
    saved.runesData = gameData.runes;
    saved.recipesData = gameData.recipes;
    saved.skillTreeData = gameData.skillTree;
    saved.starterSpells = gameData.starterSpells;
    // Ensure new fields exist for older saves
    if (saved.turnsElapsed === undefined) saved.turnsElapsed = 0;
    if (saved.hungerLevel === undefined) saved.hungerLevel = 0;
    if (!saved.player.affinities) saved.player.affinities = {};
    if (!saved.player.combatPolicy) {
      saved.player.combatPolicy = {
        lowHpThreshold: 30,
        preferDot: true,
        useForgeSpells: true,
        conserveMana: false,
      };
    }
    if (!saved.player.loadout) {
      saved.player.loadout = {
        spellSlots: [saved.player.spells[0]?.id || null, saved.player.spells[1]?.id || null, null, null],
      };
    }
    if (!saved.player.craftedSpellUsedOnFloor) saved.player.craftedSpellUsedOnFloor = {};

    ui.setState(saved, () => startNewGame());
  } else {
    // Show title screen for new game
    const titleState = createNewGame(
      gameData.floors,
      gameData.runes,
      gameData.recipes,
      gameData.starterSpells,
      gameData.skillTree,
    );
    titleState.view = 'title';
    ui.setState(titleState, () => startNewGame());
  }
}

main();
