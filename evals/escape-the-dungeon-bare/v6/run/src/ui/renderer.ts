import { GameState, Room, Spell, PhysicalSkill, ElementType, EquipSlot } from '../types';
import { getState, updateState, saveGame, clearSave, createNewGameState, setState, loadGame } from '../state';
import { icon, bar, elementTag, spellCard, skillCard, itemCard, getRoomTypeColor, getTraitColor, getElementIcon, getElementColor } from './components';
import { startCombat, startAutoResolve, pauseCombat, resumeCombat, endCombat, setAutoSpeed, fleeCombat } from '../systems/combat';
import { moveToRoom, moveToFloor, getCurrentRoom } from '../systems/navigation';
import { getAvailableRunes, craftSpell, addCraftedSpell, getAffinityRewards } from '../systems/forge';
import { ITEMS, EQUIPMENT } from '../data/items';

// Forge UI state (not persisted)
let selectedRuneIds: string[] = [];
let selectedSpellIngredient: string | null = null;
let overlayScreen: 'none' | 'inventory' | 'character' | 'spellbook' | 'map' | 'loadout' | 'policies' = 'none';
let characterTab: 'stats' | 'traits' | 'skills' | 'equipment' = 'stats';
let merchantTab: 'buy' | 'sell' = 'buy';

// Expose functions to global for onclick handlers
(window as any).gameAction = handleAction;

function handleAction(action: string, ...args: any[]): void {
  switch (action) {
    case 'newGame':
      clearSave();
      setState(createNewGameState());
      break;
    case 'continue': {
      const saved = loadGame();
      if (saved) setState(saved);
      break;
    }
    case 'moveToRoom':
      moveToRoom(args[0]);
      break;
    case 'moveToFloor':
      moveToFloor(args[0]);
      break;
    case 'startCombat': {
      const state = getState();
      const room = getCurrentRoom(state);
      if (room?.enemies) startCombat(room.enemies);
      break;
    }
    case 'autoResolve':
      startAutoResolve();
      break;
    case 'pause':
      pauseCombat();
      break;
    case 'resume':
      resumeCombat();
      break;
    case 'endCombat':
      endCombat();
      break;
    case 'setSpeed':
      setAutoSpeed(args[0]);
      break;
    case 'flee':
      fleeCombat();
      break;
    case 'overlay':
      overlayScreen = args[0];
      render();
      break;
    case 'charTab':
      characterTab = args[0];
      render();
      break;
    case 'merchantTab':
      merchantTab = args[0];
      render();
      break;
    case 'toggleRune':
      toggleRuneSelection(args[0]);
      break;
    case 'toggleSpellIngredient':
      selectedSpellIngredient = selectedSpellIngredient === args[0] ? null : args[0];
      render();
      break;
    case 'craftSpell':
      doCraftSpell();
      break;
    case 'rest':
      doRest();
      break;
    case 'useItem':
      useItem(args[0]);
      break;
    case 'buyItem':
      buyItem(args[0]);
      break;
    case 'sellItem':
      sellItem(args[0]);
      break;
    case 'equipItem':
      equipItem(args[0]);
      break;
    case 'unequipSlot':
      unequipSlot(args[0]);
      break;
    case 'equipSpell':
      equipSpellToSlot(args[0], args[1]);
      break;
    case 'unequipSpell':
      unequipSpellSlot(args[0]);
      break;
    case 'equipSkill':
      equipSkillToSlot(args[0], args[1]);
      break;
    case 'unequipSkill':
      unequipSkillSlot(args[0]);
      break;
    case 'togglePolicy':
      togglePolicy(args[0]);
      break;
    case 'unlockSkillNode':
      unlockSkillNode(args[0]);
      break;
    case 'dialogueChoice':
      handleDialogueChoice(args[0]);
      break;
    case 'eventChoice':
      handleEventChoice(args[0]);
      break;
    case 'returnToExploration':
      updateState(s => { s.screen = 'exploration'; });
      break;
    case 'openForge':
      selectedRuneIds = [];
      selectedSpellIngredient = null;
      updateState(s => { s.screen = 'forge'; });
      break;
    case 'openDialogue': {
      const st = getState();
      const rm = getCurrentRoom(st);
      if (rm?.npc) {
        updateState(s => {
          s.dialogueState = { npcId: rm.npc!.id, currentNodeId: 'start' };
          s.screen = 'dialogue';
        });
      }
      break;
    }
    case 'openEvent':
      updateState(s => { s.screen = 'event'; });
      break;
    case 'backToTitle': {
      const ts = createNewGameState();
      ts.screen = 'title';
      setState(ts);
      break;
    }
    case 'training': {
      const st2 = getState();
      const rm2 = getCurrentRoom(st2);
      if (rm2?.enemies) startCombat(rm2.enemies);
      break;
    }
  }
}

function toggleRuneSelection(runeId: string): void {
  const idx = selectedRuneIds.indexOf(runeId);
  if (idx >= 0) selectedRuneIds.splice(idx, 1);
  else if (selectedRuneIds.length < 3) selectedRuneIds.push(runeId);
  render();
}

function doCraftSpell(): void {
  const state = getState();
  const spell = craftSpell(selectedRuneIds, selectedSpellIngredient, state);
  if (spell) {
    addCraftedSpell(spell);
    selectedRuneIds = [];
    selectedSpellIngredient = null;
  }
}

function doRest(): void {
  updateState(state => {
    const healHp = Math.floor(state.player.maxHp * 0.4);
    const healMana = Math.floor(state.player.maxMana * 0.5);
    const healStamina = Math.floor(state.player.maxStamina * 0.6);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healHp);
    state.player.mana = Math.min(state.player.maxMana, state.player.mana + healMana);
    state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + healStamina);
    const room = getCurrentRoom(state);
    if (room) room.cleared = true;
    state.notifications.push({
      text: `Rested: +${healHp} HP, +${healMana} Mana, +${healStamina} Stamina`,
      type: 'info', id: state.nextNotifId++, expires: Date.now() + 4000
    });
    saveGame(state);
  });
}

function useItem(itemId: string): void {
  updateState(state => {
    const item = state.player.inventory.find(i => i.id === itemId);
    if (!item || !item.effect) return;
    if (item.effect.type === 'heal-hp') {
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + item.effect.value);
      state.notifications.push({ text: `Used ${item.name}: +${item.effect.value} HP`, type: 'info', id: state.nextNotifId++, expires: Date.now() + 3000 });
    } else if (item.effect.type === 'heal-mana') {
      state.player.mana = Math.min(state.player.maxMana, state.player.mana + item.effect.value);
      state.notifications.push({ text: `Used ${item.name}: +${item.effect.value} Mana`, type: 'info', id: state.nextNotifId++, expires: Date.now() + 3000 });
    } else if (item.effect.type === 'heal-stamina') {
      state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + item.effect.value);
      state.notifications.push({ text: `Used ${item.name}: +${item.effect.value} Stamina`, type: 'info', id: state.nextNotifId++, expires: Date.now() + 3000 });
    }
    item.quantity--;
    if (item.quantity <= 0) {
      state.player.inventory = state.player.inventory.filter(i => i.id !== itemId);
    }
  });
}

function buyItem(index: number): void {
  updateState(state => {
    const room = getCurrentRoom(state);
    if (!room?.merchantStock) return;
    const stockItem = room.merchantStock[index] as any;
    if (!stockItem) return;
    const price = stockItem.value || 10;
    if (state.player.gold < price) {
      state.notifications.push({ text: 'Not enough gold!', type: 'danger', id: state.nextNotifId++, expires: Date.now() + 3000 });
      return;
    }
    state.player.gold -= price;
    // Add to inventory
    if (stockItem.slot) {
      // Equipment
      state.player.inventory.push({
        id: stockItem.id + '-' + Math.random().toString(36).slice(2, 6),
        name: stockItem.name, category: 'equipment',
        description: stockItem.description, value: stockItem.value, quantity: 1,
        icon: 'game-icons:chest-armor'
      });
    } else if (stockItem.element) {
      // Rune
      const rune = state.player.discoveredRunes.find(r => r.id === stockItem.id);
      if (rune) rune.discovered = true;
    } else {
      const existing = state.player.inventory.find(i => i.name === stockItem.name);
      if (existing) existing.quantity++;
      else state.player.inventory.push({ ...stockItem, id: stockItem.id + '-' + Math.random().toString(36).slice(2, 6) });
    }
    room.merchantStock.splice(index, 1);
    state.notifications.push({ text: `Bought ${stockItem.name} for ${price}g`, type: 'info', id: state.nextNotifId++, expires: Date.now() + 3000 });
  });
}

function sellItem(itemId: string): void {
  updateState(state => {
    const item = state.player.inventory.find(i => i.id === itemId);
    if (!item) return;
    const price = Math.floor(item.value * 0.5);
    state.player.gold += price;
    item.quantity--;
    if (item.quantity <= 0) {
      state.player.inventory = state.player.inventory.filter(i => i.id !== itemId);
    }
    state.notifications.push({ text: `Sold ${item.name} for ${price}g`, type: 'info', id: state.nextNotifId++, expires: Date.now() + 3000 });
  });
}

function equipItem(itemId: string): void {
  updateState(state => {
    const item = state.player.inventory.find(i => i.id === itemId);
    if (!item) return;
    // Find matching equipment definition
    const equipDef = Object.values(EQUIPMENT).map(fn => fn()).find(e => e.name === item.name);
    if (!equipDef) return;
    // Unequip existing
    const existing = state.player.equipment[equipDef.slot];
    if (existing) {
      state.player.inventory.push({
        id: existing.id + '-inv', name: existing.name, category: 'equipment',
        description: existing.description, value: existing.value, quantity: 1
      });
      // Remove stats
      applyEquipStats(state, existing, false);
    }
    // Equip new
    state.player.equipment[equipDef.slot] = equipDef;
    applyEquipStats(state, equipDef, true);
    // Remove from inventory
    item.quantity--;
    if (item.quantity <= 0) {
      state.player.inventory = state.player.inventory.filter(i => i.id !== itemId);
    }
    state.notifications.push({ text: `Equipped ${equipDef.name}`, type: 'info', id: state.nextNotifId++, expires: Date.now() + 3000 });
  });
}

function unequipSlot(slot: string): void {
  updateState(state => {
    const equip = state.player.equipment[slot as EquipSlot];
    if (!equip) return;
    state.player.inventory.push({
      id: equip.id + '-inv', name: equip.name, category: 'equipment',
      description: equip.description, value: equip.value, quantity: 1
    });
    applyEquipStats(state, equip, false);
    state.player.equipment[slot as EquipSlot] = null;
  });
}

function applyEquipStats(state: GameState, equip: any, add: boolean): void {
  const mult = add ? 1 : -1;
  if (equip.stats.attack) state.player.attack += equip.stats.attack * mult;
  if (equip.stats.defense) state.player.defense += equip.stats.defense * mult;
  if (equip.stats.maxHp) {
    state.player.maxHp += equip.stats.maxHp * mult;
    if (add) state.player.hp += equip.stats.maxHp;
    else state.player.hp = Math.min(state.player.hp, state.player.maxHp);
  }
  if (equip.stats.maxMana) {
    state.player.maxMana += equip.stats.maxMana * mult;
    if (add) state.player.mana += equip.stats.maxMana;
    else state.player.mana = Math.min(state.player.mana, state.player.maxMana);
  }
  if (equip.stats.maxStamina) {
    state.player.maxStamina += equip.stats.maxStamina * mult;
    if (add) state.player.stamina += equip.stats.maxStamina;
    else state.player.stamina = Math.min(state.player.stamina, state.player.maxStamina);
  }
}

function equipSpellToSlot(slotIndex: number, spellId: string): void {
  updateState(state => {
    const spell = state.player.knownSpells.find(s => s.id === spellId);
    if (spell && slotIndex >= 0 && slotIndex < state.player.equippedSpells.length) {
      state.player.equippedSpells[slotIndex] = spell;
    }
  });
}

function unequipSpellSlot(slotIndex: number): void {
  updateState(state => {
    if (slotIndex >= 0 && slotIndex < state.player.equippedSpells.length) {
      state.player.equippedSpells[slotIndex] = null;
    }
  });
}

function equipSkillToSlot(slotIndex: number, skillId: string): void {
  updateState(state => {
    const skill = state.player.knownSkills.find(s => s.id === skillId);
    if (skill && slotIndex >= 0 && slotIndex < state.player.equippedSkills.length) {
      state.player.equippedSkills[slotIndex] = skill;
    }
  });
}

function unequipSkillSlot(slotIndex: number): void {
  updateState(state => {
    if (slotIndex >= 0 && slotIndex < state.player.equippedSkills.length) {
      state.player.equippedSkills[slotIndex] = null;
    }
  });
}

function togglePolicy(policyId: string): void {
  updateState(state => {
    const policy = state.player.actionPolicies.find(p => p.id === policyId);
    if (policy) policy.enabled = !policy.enabled;
  });
}

function unlockSkillNode(nodeId: string): void {
  updateState(state => {
    const node = state.player.skillTree.find(n => n.id === nodeId);
    if (!node || node.unlocked) return;
    if (state.player.skillPoints < node.cost) {
      state.notifications.push({ text: 'Not enough skill points!', type: 'danger', id: state.nextNotifId++, expires: Date.now() + 3000 });
      return;
    }
    // Check prerequisites
    if (node.requires) {
      for (const req of node.requires) {
        const reqNode = state.player.skillTree.find(n => n.id === req);
        if (!reqNode?.unlocked) {
          state.notifications.push({ text: `Requires: ${reqNode?.name || req}`, type: 'danger', id: state.nextNotifId++, expires: Date.now() + 3000 });
          return;
        }
      }
    }
    state.player.skillPoints -= node.cost;
    node.unlocked = true;
    // Add the skill
    const newSkills: Record<string, PhysicalSkill> = {
      'skill-power-strike': { id: 'skill-power-strike', name: 'Power Strike', staminaCost: 8, damage: 15, level: 1, xpToNext: 30, currentXp: 0 },
      'skill-whirlwind': { id: 'skill-whirlwind', name: 'Whirlwind', staminaCost: 10, damage: 10, level: 1, xpToNext: 40, currentXp: 0 },
      'skill-iron-wall': { id: 'skill-iron-wall', name: 'Iron Wall', staminaCost: 6, damage: 0, effect: { type: 'shield', value: 15, duration: 2 }, level: 1, xpToNext: 30, currentXp: 0 },
      'skill-counter': { id: 'skill-counter', name: 'Counter', staminaCost: 7, damage: 0, effect: { type: 'reflect', value: 0.5 }, level: 1, xpToNext: 35, currentXp: 0 },
      'skill-drain-strike': { id: 'skill-drain-strike', name: 'Drain Strike', staminaCost: 8, damage: 10, effect: { type: 'heal', value: 5 }, level: 1, xpToNext: 35, currentXp: 0 },
      'skill-focus': { id: 'skill-focus', name: 'Focus', staminaCost: 5, damage: 0, effect: { type: 'buff', value: 1.5 }, level: 1, xpToNext: 25, currentXp: 0 },
    };
    const skill = newSkills[node.skillId];
    if (skill) {
      state.player.knownSkills.push(skill);
      state.notifications.push({ text: `Unlocked: ${skill.name}!`, type: 'reward', id: state.nextNotifId++, expires: Date.now() + 4000 });
    }
  });
}

function handleDialogueChoice(choiceIndex: number): void {
  updateState(state => {
    if (!state.dialogueState) return;
    const floor = state.floors[state.currentFloor];
    const room = floor.rooms.find(r => r.id === state.currentRoomId);
    if (!room?.npc) return;
    const npc = room.npc;
    const node = npc.dialogue.find(d => d.id === state.dialogueState!.currentNodeId);
    if (!node) return;
    const choice = node.choices[choiceIndex];
    if (!choice) return;
    // Apply trait shifts
    if (choice.traitShift) {
      for (const [key, val] of Object.entries(choice.traitShift)) {
        const k = key as keyof typeof state.player.traits;
        state.player.traits[k] = Math.max(0, Math.min(1, state.player.traits[k] + (val || 0)));
        if (val && val !== 0) {
          state.notifications.push({
            text: `${val > 0 ? '+' : ''}${val.toFixed(2)} ${key}`,
            type: 'trait', id: state.nextNotifId++, expires: Date.now() + 3000
          });
        }
      }
    }
    // Apply effect
    if (choice.effect) {
      choice.effect(state);
    }
    // Navigate
    if (choice.nextId) {
      state.dialogueState.currentNodeId = choice.nextId;
    } else {
      // End dialogue
      npc.met = true;
      room.cleared = true;
      state.dialogueState = null;
      state.screen = 'exploration';
      saveGame(state);
    }
  });
}

function handleEventChoice(choiceIndex: number): void {
  updateState(state => {
    const room = getCurrentRoom(state);
    if (!room?.eventData) return;
    const choice = room.eventData.choices[choiceIndex];
    if (!choice) return;
    choice.effect(state);
    room.cleared = true;
    state.notifications.push({ text: choice.resultText, type: 'info', id: state.nextNotifId++, expires: Date.now() + 4000 });
    state.screen = 'exploration';
    saveGame(state);
  });
}

// ===== RENDER =====
export function render(): void {
  const state = getState();
  if (!state) return;

  const app = document.getElementById('app')!;

  // Save scroll position of combat log before render
  const logEl = document.getElementById('combat-log');
  const wasScrolledToBottom = logEl ? logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 20 : true;

  // Clean up expired notifications
  const now = Date.now();
  state.notifications = state.notifications.filter(n => n.expires > now);

  // Update game time
  state.gameTime = now - state.gameStartTime;

  let html = '';

  if (state.screen === 'title' || !(state as any).screen) {
    html = renderTitle();
  } else if (state.screen === 'gameover') {
    html = renderGameOver(state);
  } else if (state.screen === 'victory') {
    html = renderVictory(state);
  } else {
    html = renderHUD(state);
    html += '<div class="game-layout">';
    html += '<div class="main-panel">';

    if (state.screen === 'combat') {
      html += renderCombat(state);
    } else if (state.screen === 'forge') {
      html += renderForge(state);
    } else if (state.screen === 'dialogue') {
      html += renderDialogue(state);
    } else if (state.screen === 'event') {
      html += renderEvent(state);
    } else {
      html += renderExploration(state);
    }

    html += '</div>'; // main-panel
    html += renderSidePanel(state);
    html += '</div>'; // game-layout

    // Overlay
    if (overlayScreen !== 'none') {
      html += renderOverlay(state);
    }
  }

  // Notifications
  html += renderNotifications(state);

  app.innerHTML = html;

  // Auto-scroll combat log if it was at bottom
  if (wasScrolledToBottom) {
    const newLogEl = document.getElementById('combat-log');
    if (newLogEl) newLogEl.scrollTop = newLogEl.scrollHeight;
  }
}

function renderTitle(): string {
  const hasSave = !!localStorage.getItem('escape-dungeon-save');
  return `
    <div class="title-screen">
      <div style="font-size:64px;margin-bottom:20px">${icon('game-icons:dungeon-gate', 80)}</div>
      <h1>Escape the Dungeon</h1>
      <p class="subtitle">A roguelike of ingenuity and spell craft</p>
      <div style="display:flex;gap:12px;margin-top:20px">
        <button class="btn btn-primary btn-lg" onclick="gameAction('newGame')">${icon('game-icons:crossed-swords', 18)} New Game</button>
        ${hasSave ? `<button class="btn btn-lg" onclick="gameAction('continue')">${icon('game-icons:save', 18)} Continue</button>` : ''}
      </div>
      <div style="color:var(--text-dim);margin-top:40px;font-size:12px;max-width:500px;text-align:center">
        <p>Craft spells from discovered runes. Configure action policies for auto-combat.</p>
        <p style="margin-top:8px">Starter spells won't cut it. You must craft to survive.</p>
      </div>
    </div>
  `;
}

function renderHUD(state: GameState): string {
  const p = state.player;
  const floor = state.floors[state.currentFloor];
  const gameMinutes = Math.floor(state.gameTime / 60000);
  const gameDays = Math.floor(gameMinutes / 60); // 1 real hour = 1 game day
  const gameHour = gameMinutes % 60;
  const timeStr = `Day ${gameDays + 1}, ${gameHour < 30 ? 'Morning' : 'Evening'}`;

  return `
    <div class="hud">
      <div class="hud-section">
        ${icon('game-icons:person', 16)}
        <span class="hud-value">${p.name} Lv.${p.level}</span>
      </div>
      <div class="hud-section">
        <span class="hud-label">HP</span>
        ${bar(p.hp, p.maxHp, 'hp-bar')}
      </div>
      <div class="hud-section">
        <span class="hud-label">MP</span>
        ${bar(p.mana, p.maxMana, 'mana-bar')}
      </div>
      <div class="hud-section">
        <span class="hud-label">STA</span>
        ${bar(p.stamina, p.maxStamina, 'stamina-bar', '80px')}
      </div>
      <div class="hud-section">
        <span class="hud-label">XP</span>
        ${bar(p.xp, p.xpToNext, 'xp-bar', '70px')}
      </div>
      <div class="hud-section">
        ${icon('game-icons:two-coins', 14)}
        <span class="hud-value" style="color:var(--gold)">${p.gold}</span>
      </div>
      <div class="hud-section">
        <span class="hud-label">${icon('game-icons:stairs', 14)} Floor</span>
        <span class="hud-value">${floor.name}</span>
      </div>
      <div class="hud-section game-clock">
        ${icon('game-icons:sun', 14)} ${timeStr}
      </div>
      <div style="flex:1"></div>
      <div class="hud-section" style="gap:4px">
        <button class="btn btn-sm" onclick="gameAction('overlay','map')">${icon('game-icons:treasure-map', 14)} Map</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','inventory')">${icon('game-icons:swap-bag', 14)} Bag</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','character')">${icon('game-icons:character', 14)} Stats</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','spellbook')">${icon('game-icons:spell-book', 14)} Spells</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','loadout')">${icon('game-icons:battle-gear', 14)} Loadout</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','policies')">${icon('game-icons:brain', 14)} Policies</button>
      </div>
    </div>
  `;
}

function renderExploration(state: GameState): string {
  const room = getCurrentRoom(state);
  if (!room) return '<div class="room-content">No room found</div>';

  const floor = state.floors[state.currentFloor];
  const typeColor = getRoomTypeColor(room.type);

  let html = '';

  // Floor tabs
  html += '<div class="floor-tabs">';
  for (const f of state.floors) {
    const cls = f.id - 1 === state.currentFloor ? 'active' : (f.unlocked ? '' : 'locked');
    html += `<button class="floor-tab ${cls}" ${f.unlocked && f.id - 1 !== state.currentFloor ? `onclick="gameAction('moveToFloor',${f.id - 1})"` : ''}>${f.name}${!f.unlocked ? ' (Locked)' : ''}</button>`;
  }
  html += '</div>';

  // Room header
  html += `
    <div class="room-header">
      <div class="room-icon" style="border-color:${typeColor}">
        ${icon(room.icon, 32)}
      </div>
      <div class="room-info">
        <h2>${room.name}</h2>
        <span class="room-type" style="color:${typeColor}">${room.type.toUpperCase()}${room.cleared ? ' - CLEARED' : ''}</span>
      </div>
    </div>
    <div class="room-description">${room.description}</div>
  `;

  // Room content based on type
  html += '<div class="room-content">';

  if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss') {
    if (!room.cleared && room.enemies && room.enemies.length > 0) {
      html += '<div class="section-title">Enemies</div>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
      for (const enemy of room.enemies) {
        html += `
          <div style="text-align:center;padding:12px;background:var(--bg-panel);border-radius:8px;border:1px solid var(--border);min-width:120px">
            <div style="font-size:32px;margin-bottom:4px">${icon(enemy.icon, 32)}</div>
            <div style="font-weight:600;font-size:13px">${enemy.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">HP: ${enemy.hp} | ATK: ${enemy.attack} | DEF: ${enemy.defense}</div>
            ${enemy.weaknesses.length > 0 ? `<div style="margin-top:4px">${enemy.weaknesses.map(w => elementTag(w as ElementType)).join(' ')}<span style="font-size:10px;color:var(--text-dim)"> weak</span></div>` : ''}
            <div style="font-size:10px;color:var(--text-dim);margin-top:4px">${enemy.behavior}</div>
          </div>
        `;
      }
      html += '</div>';
      if (room.type === 'boss') {
        html += `<div style="color:var(--warning);font-size:12px;margin-bottom:8px">${icon('game-icons:warning-sign', 14)} ${floor.mechanicalConstraint}</div>`;
      }
    } else {
      html += '<p style="color:var(--text-dim)">This area has been cleared.</p>';
    }
  }

  if (room.type === 'training') {
    html += '<p style="margin-bottom:8px">Practice against training dummies to build spell affinity. Low XP, no loot, but safe casting.</p>';
  }

  if (room.type === 'forge') {
    html += '<p style="margin-bottom:8px">The forge glows with ancient power. Combine runes to craft new spells.</p>';
    // Show affinities
    html += '<div class="section-title">Rune Affinities</div>';
    const elements: ElementType[] = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane'];
    for (const el of elements) {
      const aff = state.player.affinities[el] || 0;
      const rewards = getAffinityRewards(el, aff);
      html += `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          ${icon(getElementIcon(el), 16)}
          <span style="width:70px;font-size:12px;color:${getElementColor(el)}">${el}</span>
          ${bar(aff, 100, 'affinity-bar', '80px')}
          <span style="font-size:11px;color:var(--text-dim)">${aff}/100</span>
          ${rewards.length > 0 ? `<span style="font-size:10px;color:var(--success)">${rewards[rewards.length - 1]}</span>` : ''}
        </div>
      `;
    }
  }

  if (room.type === 'rest') {
    html += '<p style="margin-bottom:8px">A peaceful spot to recover your strength. Rest restores 40% HP, 50% Mana, 60% Stamina.</p>';
    html += '<p style="font-size:12px;color:var(--text-dim)">You can also change your loadout here.</p>';
  }

  if (room.type === 'merchant' && room.merchantStock) {
    html += renderMerchantContent(state, room);
  }

  if (room.npc && room.type === 'event') {
    if (room.npc.met) {
      html += `<p style="color:var(--text-dim)">You've already spoken with ${room.npc.name}.</p>`;
    } else {
      html += `<p>${room.npc.name} awaits.</p>`;
    }
  }

  if (room.eventData && room.type === 'event' && !room.npc) {
    if (room.cleared) {
      html += '<p style="color:var(--text-dim)">You have already made your choice here.</p>';
    }
  }

  html += '</div>';

  // Room actions
  html += '<div class="room-actions">';
  if ((room.type === 'combat' || room.type === 'elite' || room.type === 'boss') && !room.cleared && room.enemies && room.enemies.length > 0) {
    html += `<button class="btn btn-primary" onclick="gameAction('startCombat')">${icon('game-icons:crossed-swords', 16)} Engage Combat</button>`;
  }
  if (room.type === 'training') {
    html += `<button class="btn btn-primary" onclick="gameAction('training')">${icon('game-icons:training', 16)} Train (Combat Dummy)</button>`;
  }
  if (room.type === 'forge') {
    html += `<button class="btn btn-primary" onclick="gameAction('openForge')">${icon('game-icons:anvil', 16)} Open Forge</button>`;
  }
  if (room.type === 'rest') {
    html += `<button class="btn btn-success" onclick="gameAction('rest')">${icon('game-icons:campfire', 16)} Rest</button>`;
    html += `<button class="btn" onclick="gameAction('overlay','loadout')">${icon('game-icons:battle-gear', 16)} Change Loadout</button>`;
  }
  if (room.npc && room.type === 'event' && !room.npc.met) {
    html += `<button class="btn btn-primary" onclick="gameAction('openDialogue')">${icon('game-icons:talk', 16)} Talk to ${room.npc.name}</button>`;
  }
  if (room.eventData && !room.cleared && !room.npc) {
    html += `<button class="btn btn-primary" onclick="gameAction('openEvent')">${icon('game-icons:scroll-unfurled', 16)} Investigate</button>`;
  }

  // Navigation to adjacent rooms
  const adjacentRooms = room.connections
    .map(id => floor.rooms.find(r => r.id === id))
    .filter((r): r is Room => r !== null);

  if (adjacentRooms.length > 0) {
    html += '<div style="flex:1"></div>';
    for (const adj of adjacentRooms) {
      const typeCol = getRoomTypeColor(adj.type);
      html += `<button class="btn btn-sm" style="border-color:${typeCol}" onclick="gameAction('moveToRoom','${adj.id}')">${icon(adj.icon, 14)} ${adj.name}${adj.cleared ? ' *' : ''}</button>`;
    }
  }
  html += '</div>';

  return html;
}

function renderMerchantContent(state: GameState, room: Room): string {
  let html = '<div class="section-title">Merchant</div>';
  html += `<div style="margin-bottom:8px">
    <button class="btn btn-sm ${merchantTab === 'buy' ? 'btn-primary' : ''}" onclick="gameAction('merchantTab','buy')">Buy</button>
    <button class="btn btn-sm ${merchantTab === 'sell' ? 'btn-primary' : ''}" onclick="gameAction('merchantTab','sell')">Sell</button>
  </div>`;

  if (merchantTab === 'buy' && room.merchantStock) {
    for (let i = 0; i < room.merchantStock.length; i++) {
      const item = room.merchantStock[i] as any;
      const canAfford = state.player.gold >= (item.value || 10);
      html += `
        <div class="merchant-item">
          <div style="font-size:20px">${icon(item.icon || 'game-icons:swap-bag', 20)}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:12px">${item.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">${item.description || ''}</div>
          </div>
          <div style="color:var(--gold);font-weight:600">${item.value || 10}g</div>
          <button class="btn btn-sm btn-success" ${!canAfford ? 'disabled' : ''} onclick="gameAction('buyItem',${i})">Buy</button>
        </div>
      `;
    }
    if (room.merchantStock.length === 0) {
      html += '<p style="color:var(--text-dim)">Sold out!</p>';
    }
  }

  if (merchantTab === 'sell') {
    for (const item of state.player.inventory) {
      const price = Math.floor(item.value * 0.5);
      html += `
        <div class="merchant-item">
          <div style="font-size:20px">${icon(item.icon || 'game-icons:swap-bag', 20)}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:12px">${item.name} ${item.quantity > 1 ? 'x' + item.quantity : ''}</div>
          </div>
          <div style="color:var(--gold)">${price}g</div>
          <button class="btn btn-sm" onclick="gameAction('sellItem','${item.id}')">Sell</button>
        </div>
      `;
    }
    if (state.player.inventory.length === 0) {
      html += '<p style="color:var(--text-dim)">Nothing to sell.</p>';
    }
  }

  return html;
}

function renderCombat(state: GameState): string {
  if (!state.combatState) return '';
  const cs = state.combatState;
  const p = state.player;

  let html = '';

  // Combat arena - player vs enemies (UO style)
  html += '<div class="combat-arena">';

  // Player side
  html += `
    <div class="combat-side player-side">
      <div class="combat-entity">
        <div class="entity-portrait player-portrait">${icon('game-icons:mage-staff', 36)}</div>
        <div class="entity-name" style="color:var(--mana-bar)">${p.name}</div>
        <div class="entity-hp">${bar(p.hp, p.maxHp, 'hp-bar', '120px')}</div>
        <div style="margin-top:4px">${bar(p.mana, p.maxMana, 'mana-bar', '100px')}</div>
        <div style="margin-top:4px">${bar(p.stamina, p.maxStamina, 'stamina-bar', '80px')}</div>
      </div>
    </div>
  `;

  // VS
  html += `<div class="combat-vs">VS</div>`;

  // Enemy side
  html += '<div class="combat-side enemy-side">';
  for (const enemy of cs.enemies) {
    const dead = enemy.hp <= 0;
    html += `
      <div class="combat-entity" style="${dead ? 'opacity:0.3' : ''}">
        <div class="entity-portrait enemy-portrait">${icon(enemy.icon, 36)}</div>
        <div class="entity-name" style="color:var(--hp-bar)">${enemy.name}${dead ? ' (Dead)' : ''}</div>
        <div class="entity-hp">${bar(Math.max(0, enemy.hp), enemy.maxHp, 'hp-bar', '120px')}</div>
        <div style="font-size:10px;color:var(--text-dim)">
          ${enemy.weaknesses.map(w => elementTag(w as ElementType)).join(' ')}
          <span style="margin-left:4px">${enemy.behavior}</span>
        </div>
      </div>
    `;
  }
  html += '</div>';
  html += '</div>';

  // Combat log
  html += '<div class="combat-log" id="combat-log">';
  for (const entry of state.combatLog.slice(-30)) {
    html += `<div class="log-${entry.type}">${entry.text}</div>`;
  }
  html += '</div>';

  // Combat controls
  html += '<div class="combat-controls">';
  if (cs.combatOver) {
    html += `<button class="btn btn-primary btn-lg" onclick="gameAction('endCombat')">${cs.result === 'victory' ? icon('game-icons:trophy', 18) + ' Collect Rewards' : icon('game-icons:skull', 18) + ' Accept Defeat'}</button>`;
  } else if (state.paused) {
    html += `<button class="btn btn-primary" onclick="gameAction('resume')">${icon('game-icons:play-button', 16)} Resume</button>`;
    html += `<button class="btn" onclick="gameAction('overlay','loadout')">${icon('game-icons:battle-gear', 16)} Adjust Loadout</button>`;
    html += `<button class="btn" onclick="gameAction('overlay','policies')">${icon('game-icons:brain', 16)} Adjust Policies</button>`;
    html += `<button class="btn" onclick="gameAction('overlay','inventory')">${icon('game-icons:swap-bag', 16)} Use Items</button>`;
    html += `<button class="btn btn-danger" onclick="gameAction('flee')">${icon('game-icons:run', 16)} Flee</button>`;
  } else if (!cs.isAutoResolving) {
    html += `<button class="btn btn-primary" onclick="gameAction('autoResolve')">${icon('game-icons:play-button', 16)} Start Auto-Combat</button>`;
  } else {
    html += `<button class="btn" onclick="gameAction('pause')">${icon('game-icons:pause-button', 16)} Pause</button>`;
  }

  if (!cs.combatOver) {
    html += `<span class="speed-label">Speed:</span>`;
    html += `<button class="btn btn-sm ${cs.autoSpeed === 1200 ? 'btn-primary' : ''}" onclick="gameAction('setSpeed',1200)">Slow</button>`;
    html += `<button class="btn btn-sm ${cs.autoSpeed === 800 ? 'btn-primary' : ''}" onclick="gameAction('setSpeed',800)">Normal</button>`;
    html += `<button class="btn btn-sm ${cs.autoSpeed === 400 ? 'btn-primary' : ''}" onclick="gameAction('setSpeed',400)">Fast</button>`;
    html += `<button class="btn btn-sm ${cs.autoSpeed === 150 ? 'btn-primary' : ''}" onclick="gameAction('setSpeed',150)">Ultra</button>`;
  }
  html += '</div>';

  return html;
}

function renderForge(state: GameState): string {
  const availableRunes = getAvailableRunes(state);
  const allRunes = state.player.discoveredRunes;

  let html = `
    <div class="room-header">
      <div class="room-icon" style="border-color:var(--fire)">${icon('game-icons:anvil', 32)}</div>
      <div class="room-info">
        <h2>Rune Forge</h2>
        <span class="room-type" style="color:var(--fire)">CRAFT SPELLS</span>
      </div>
    </div>
  `;

  html += '<div class="room-content">';

  // Rune selection
  html += '<div class="section-title">Select Runes (1-3, unique only)</div>';
  html += '<div class="forge-grid">';
  for (const rune of allRunes) {
    const isSelected = selectedRuneIds.includes(rune.id);
    const isLocked = !rune.discovered;
    html += `
      <div class="rune-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}"
        ${!isLocked ? `onclick="gameAction('toggleRune','${rune.id}')"` : ''}>
        <div style="font-size:24px">${icon(getElementIcon(rune.element as ElementType), 24)}</div>
        <div style="font-weight:600;font-size:12px;color:${getElementColor(rune.element as ElementType)}">${isLocked ? '???' : rune.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${isLocked ? 'Undiscovered' : rune.element}</div>
        ${!isLocked ? `<div style="font-size:10px;color:var(--text-dim)">${rune.description}</div>` : ''}
      </div>
    `;
  }
  html += '</div>';

  // Spell ingredient (optional)
  const eligibleSpells = state.player.knownSpells.filter(s => s.affinity >= 10);
  if (eligibleSpells.length > 0) {
    html += '<div class="section-title">Spell Ingredient (Optional - needs 10+ affinity)</div>';
    html += '<div class="forge-grid">';
    for (const spell of eligibleSpells) {
      const isSelected = selectedSpellIngredient === spell.id;
      html += spellCard(spell, isSelected, `gameAction('toggleSpellIngredient','${spell.id}')`);
    }
    html += '</div>';
  }

  // Preview
  if (selectedRuneIds.length >= 1) {
    const preview = craftSpell(selectedRuneIds, selectedSpellIngredient, state);
    if (preview) {
      html += '<div class="section-title">Preview</div>';
      html += `<div style="padding:12px;background:var(--bg-panel);border:1px solid var(--accent);border-radius:8px">
        <div style="font-weight:700;font-size:16px;color:var(--text-bright)">${preview.name}</div>
        <div style="margin-top:4px">${preview.elements.map(e => elementTag(e as ElementType)).join(' ')}</div>
        <div style="margin-top:4px;font-size:13px">${preview.damage > 0 ? 'Damage: ' + preview.damage : ''}${preview.effect ? ' | Effect: ' + preview.effect.type + (preview.effect.value ? ' (' + preview.effect.value + ')' : '') : ''}</div>
        <div style="font-size:12px;color:var(--text-dim)">Mana cost: ${preview.manaCost}</div>
      </div>`;
    }
  }

  html += '</div>';

  // Forge actions
  html += '<div class="room-actions">';
  html += `<button class="btn btn-primary" ${selectedRuneIds.length < 1 ? 'disabled' : ''} onclick="gameAction('craftSpell')">${icon('game-icons:anvil', 16)} Craft Spell</button>`;
  html += `<button class="btn" onclick="gameAction('returnToExploration')">Back</button>`;
  html += '</div>';

  return html;
}

function renderDialogue(state: GameState): string {
  if (!state.dialogueState) return '';
  const floor = state.floors[state.currentFloor];
  const room = floor.rooms.find(r => r.id === state.currentRoomId);
  if (!room?.npc) return '';

  const npc = room.npc;
  const node = npc.dialogue.find(d => d.id === state.dialogueState!.currentNodeId);
  if (!node) return '<div class="room-content">Dialogue ended.</div>';

  let html = '<div class="room-content"><div class="dialogue-box">';

  // Portrait and name
  html += `
    <div class="dialogue-portrait">
      <div class="portrait-icon">${icon(npc.icon, 40)}</div>
      <div>
        <h3>${npc.name}</h3>
        <div style="font-size:11px;color:var(--text-dim)">
          ${Object.entries(npc.traits).map(([k, v]) => `${k}: ${(v as number).toFixed(1)}`).join(' | ')}
        </div>
      </div>
    </div>
  `;

  // Text
  html += `<div class="dialogue-text">${node.text}</div>`;

  // Choices
  html += '<div class="dialogue-choices">';
  for (let i = 0; i < node.choices.length; i++) {
    const choice = node.choices[i];
    if (choice.condition && !choice.condition(state)) continue;
    html += `<div class="dialogue-choice" onclick="gameAction('dialogueChoice',${i})">${choice.text}</div>`;
  }
  html += '</div></div></div>';

  return html;
}

function renderEvent(state: GameState): string {
  const room = getCurrentRoom(state);
  if (!room?.eventData) return '';

  let html = '<div class="room-content">';
  html += `<div class="event-text">${room.eventData.text}</div>`;
  html += '<div class="event-choices">';
  for (let i = 0; i < room.eventData.choices.length; i++) {
    const choice = room.eventData.choices[i];
    html += `<div class="dialogue-choice" onclick="gameAction('eventChoice',${i})">${choice.text}</div>`;
  }
  html += '</div></div>';

  return html;
}

function renderSidePanel(state: GameState): string {
  let html = '<div class="side-panel">';

  // Mini map
  html += '<div class="panel-header">' + icon('game-icons:treasure-map', 16) + ' Map</div>';
  html += '<div class="panel-body">';
  html += renderMiniMap(state);
  html += '</div>';

  // Equipped spells
  html += '<div class="panel-header">' + icon('game-icons:spell-book', 16) + ' Loadout</div>';
  html += '<div class="panel-body" style="max-height:200px">';
  html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">Spells:</div>';
  for (const spell of state.player.equippedSpells) {
    if (spell) {
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:11px">
        ${icon(getElementIcon(spell.elements[0] as ElementType), 14)}
        <span>${spell.name}</span>
        <span style="color:var(--text-dim);margin-left:auto">${spell.manaCost}mp</span>
      </div>`;
    }
  }
  html += '<div style="font-size:11px;color:var(--text-dim);margin:4px 0">Skills:</div>';
  for (const skill of state.player.equippedSkills) {
    if (skill) {
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:11px">
        ${icon('game-icons:sword-brandish', 14)}
        <span>${skill.name}</span>
        <span style="color:var(--text-dim);margin-left:auto">${skill.staminaCost}sta</span>
      </div>`;
    }
  }
  html += '</div>';

  html += '</div>';
  return html;
}

function renderMiniMap(state: GameState): string {
  const floor = state.floors[state.currentFloor];
  const rooms = floor.rooms;

  // Find grid bounds
  let maxX = 0, maxY = 0;
  for (const r of rooms) { maxX = Math.max(maxX, r.x); maxY = Math.max(maxY, r.y); }

  let html = `<div class="map-grid" style="grid-template-columns:repeat(${maxX + 1}, 48px)">`;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      const room = rooms.find(r => r.x === x && r.y === y);
      if (!room) {
        html += `<div style="width:48px;height:48px"></div>`;
        continue;
      }

      const isCurrent = room.id === state.currentRoomId;
      const isAdjacent = !isCurrent && room.discovered && getCurrentRoom(state)?.connections.includes(room.id);
      const cls = [
        'map-cell',
        room.discovered ? 'discovered' : 'undiscovered',
        isCurrent ? 'current' : '',
        room.cleared ? 'cleared' : '',
        isAdjacent ? 'adjacent' : '',
      ].join(' ');

      const click = isAdjacent ? `onclick="gameAction('moveToRoom','${room.id}')"` : '';

      html += `
        <div class="${cls}" ${click} title="${room.discovered ? room.name : '???'}" style="border-color:${isCurrent ? 'var(--accent-light)' : room.discovered ? getRoomTypeColor(room.type) : 'transparent'}">
          ${room.discovered ? `<div class="map-cell-icon" style="color:${getRoomTypeColor(room.type)}">${icon(room.icon, 18)}</div>` : '?'}
          <div class="map-cell-name" style="font-size:8px">${room.discovered ? room.name.split(' ')[0] : ''}</div>
          ${isCurrent ? `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:var(--accent-light);border-radius:50%;border:1px solid var(--bg-dark)"></div>` : ''}
        </div>
      `;
    }
  }
  html += '</div>';
  return html;
}

function renderOverlay(state: GameState): string {
  let html = '<div class="overlay">';
  html += `<div class="overlay-header">
    <h2>${overlayScreen === 'inventory' ? 'Inventory' : overlayScreen === 'character' ? 'Character' : overlayScreen === 'spellbook' ? 'Spellbook' : overlayScreen === 'map' ? 'Dungeon Map' : overlayScreen === 'loadout' ? 'Loadout' : 'Action Policies'}</h2>
    <button class="btn" onclick="gameAction('overlay','none')">Close (Esc)</button>
  </div>`;

  html += '<div class="overlay-body">';

  switch (overlayScreen) {
    case 'inventory': html += renderInventoryOverlay(state); break;
    case 'character': html += renderCharacterOverlay(state); break;
    case 'spellbook': html += renderSpellbookOverlay(state); break;
    case 'map': html += renderMapOverlay(state); break;
    case 'loadout': html += renderLoadoutOverlay(state); break;
    case 'policies': html += renderPoliciesOverlay(state); break;
  }

  html += '</div></div>';
  return html;
}

function renderInventoryOverlay(state: GameState): string {
  const p = state.player;
  let html = '';

  // Equipment slots
  html += '<div class="section-title">Equipment</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">';
  const slots: EquipSlot[] = ['main-hand', 'off-hand', 'body', 'trinket'];
  for (const slot of slots) {
    const equip = p.equipment[slot];
    html += `
      <div class="equip-slot ${equip ? 'filled' : ''}">
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase">${slot}</div>
        ${equip ? `
          <div style="font-size:12px;font-weight:600">${equip.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${Object.entries(equip.stats).map(([k, v]) => `+${v} ${k}`).join(', ')}</div>
          <button class="btn btn-sm" style="margin-top:4px" onclick="gameAction('unequipSlot','${slot}')">Unequip</button>
        ` : `<div style="color:var(--text-dim);font-size:11px">Empty</div>`}
      </div>
    `;
  }
  html += '</div>';

  // Bag
  html += '<div class="section-title">Bag</div>';
  if (p.inventory.length === 0) {
    html += '<p style="color:var(--text-dim)">Empty.</p>';
  } else {
    html += '<div class="inventory-grid">';
    for (const item of p.inventory) {
      const isEquipment = item.category === 'equipment';
      const hasEffect = item.effect && (item.effect.type === 'heal-hp' || item.effect.type === 'heal-mana' || item.effect.type === 'heal-stamina');
      html += `
        <div class="item-card">
          <div style="font-size:20px">${icon(item.icon || 'game-icons:swap-bag', 20)}</div>
          <div style="font-weight:600;font-size:11px">${item.name}${item.quantity > 1 ? ' x' + item.quantity : ''}</div>
          <div style="font-size:10px;color:var(--text-dim)">${item.description || ''}</div>
          <div style="display:flex;gap:4px;margin-top:4px;justify-content:center">
            ${hasEffect ? `<button class="btn btn-sm btn-success" onclick="gameAction('useItem','${item.id}')">Use</button>` : ''}
            ${isEquipment ? `<button class="btn btn-sm" onclick="gameAction('equipItem','${item.id}')">Equip</button>` : ''}
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  return html;
}

function renderCharacterOverlay(state: GameState): string {
  const p = state.player;
  let html = '';

  // Tabs
  html += '<div style="display:flex;gap:4px;margin-bottom:16px">';
  for (const tab of ['stats', 'traits', 'skills', 'equipment'] as const) {
    html += `<button class="btn btn-sm ${characterTab === tab ? 'btn-primary' : ''}" onclick="gameAction('charTab','${tab}')">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>`;
  }
  html += '</div>';

  if (characterTab === 'stats') {
    html += '<div style="max-width:400px">';
    const stats = [
      ['Level', p.level.toString()],
      ['HP', `${p.hp}/${p.maxHp}`],
      ['Mana', `${p.mana}/${p.maxMana}`],
      ['Stamina', `${p.stamina}/${p.maxStamina}`],
      ['Attack', p.attack.toString()],
      ['Defense', p.defense.toString()],
      ['XP', `${p.xp}/${p.xpToNext}`],
      ['Gold', p.gold.toString()],
      ['Skill Points', p.skillPoints.toString()],
    ];
    for (const [label, val] of stats) {
      html += `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${val}</span></div>`;
    }

    // Affinities
    html += '<div class="section-title">Rune Affinities</div>';
    const elements: ElementType[] = ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane'];
    for (const el of elements) {
      const aff = p.affinities[el] || 0;
      html += `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          ${icon(getElementIcon(el), 14)}
          <span style="width:70px;font-size:12px;color:${getElementColor(el)}">${el}</span>
          ${bar(aff, 100, 'affinity-bar', '60px')}
          <span style="font-size:11px">${aff}</span>
        </div>
      `;
    }

    // Resistances from equipment
    html += '<div class="section-title">Equipment Bonuses</div>';
    for (const slot of ['main-hand', 'off-hand', 'body', 'trinket'] as const) {
      const equip = p.equipment[slot];
      if (equip) {
        html += `<div class="stat-row"><span class="stat-label">${slot}: ${equip.name}</span><span class="stat-value">${Object.entries(equip.stats).map(([k, v]) => `+${v} ${k}`).join(', ')}</span></div>`;
      }
    }

    html += '</div>';
  }

  if (characterTab === 'traits') {
    html += '<div style="max-width:400px">';
    html += '<p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">Traits shift based on your choices, dialogue, and combat actions.</p>';
    for (const [key, val] of Object.entries(p.traits)) {
      const numVal = val as number;
      html += `
        <div class="trait-row">
          <span style="width:120px;font-size:12px">${key}</span>
          <div class="trait-bar">
            <div class="trait-fill" style="width:${numVal * 100}%;background:${getTraitColor(key)}"></div>
          </div>
          <span style="font-size:12px;width:40px;text-align:right">${numVal.toFixed(2)}</span>
        </div>
      `;
    }
    html += '</div>';
  }

  if (characterTab === 'skills') {
    html += `<p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">Skill Points: ${p.skillPoints}</p>`;
    html += '<div class="skill-tree">';
    for (const node of p.skillTree) {
      const canUnlock = !node.unlocked && p.skillPoints >= node.cost && (!node.requires || node.requires.every(r => p.skillTree.find(n => n.id === r)?.unlocked));
      const cls = node.unlocked ? 'unlocked' : canUnlock ? 'available' : 'locked';
      html += `
        <div class="skill-node ${cls}" ${canUnlock ? `onclick="gameAction('unlockSkillNode','${node.id}')"` : ''}>
          <div style="font-weight:600;font-size:12px">${node.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${node.description}</div>
          <div style="font-size:10px;margin-top:4px;color:${node.unlocked ? 'var(--success)' : 'var(--accent)'}">
            ${node.unlocked ? 'UNLOCKED' : `Cost: ${node.cost} SP`}
          </div>
          ${node.requires ? `<div style="font-size:9px;color:var(--text-dim)">Requires: ${node.requires.map(r => p.skillTree.find(n => n.id === r)?.name || r).join(', ')}</div>` : ''}
        </div>
      `;
    }
    html += '</div>';

    // Known skills
    html += '<div class="section-title">Known Physical Skills</div>';
    html += '<div class="forge-grid">';
    for (const skill of p.knownSkills) {
      html += skillCard(skill);
    }
    html += '</div>';
  }

  if (characterTab === 'equipment') {
    return renderInventoryOverlay(state);
  }

  return html;
}

function renderSpellbookOverlay(state: GameState): string {
  const p = state.player;
  let html = '<div class="section-title">Known Spells</div>';
  html += '<div class="forge-grid">';
  for (const spell of p.knownSpells) {
    html += spellCard(spell);
  }
  html += '</div>';

  // Discovered runes
  html += '<div class="section-title">Discovered Runes</div>';
  html += '<div class="forge-grid">';
  for (const rune of p.discoveredRunes) {
    html += `
      <div class="rune-card ${!rune.discovered ? 'locked' : ''}">
        <div style="font-size:20px">${icon(getElementIcon(rune.element as ElementType), 20)}</div>
        <div style="font-weight:600;font-size:12px;color:${rune.discovered ? getElementColor(rune.element as ElementType) : 'var(--text-dim)'}">${rune.discovered ? rune.name : '???'}</div>
        <div style="font-size:10px;color:var(--text-dim)">${rune.discovered ? rune.element : 'Undiscovered'}</div>
      </div>
    `;
  }
  html += '</div>';

  return html;
}

function renderMapOverlay(state: GameState): string {
  const floor = state.floors[state.currentFloor];
  const rooms = floor.rooms;

  // Floor tabs
  let html = '<div style="display:flex;gap:8px;margin-bottom:16px">';
  for (const f of state.floors) {
    const cls = f.id - 1 === state.currentFloor ? 'btn-primary' : '';
    html += `<button class="btn ${cls}" ${f.unlocked ? `onclick="gameAction('moveToFloor',${f.id - 1});gameAction('overlay','none')"` : 'disabled'}>${f.name}${!f.unlocked ? ' (Locked)' : ''}</button>`;
  }
  html += '</div>';

  html += `<p style="color:var(--warning);font-size:12px;margin-bottom:12px">${icon('game-icons:warning-sign', 14)} ${floor.mechanicalConstraint}</p>`;

  // Full map grid
  let maxX = 0, maxY = 0;
  for (const r of rooms) { maxX = Math.max(maxX, r.x); maxY = Math.max(maxY, r.y); }

  html += `<div class="map-grid" style="grid-template-columns:repeat(${maxX + 1}, 72px)">`;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      const room = rooms.find(r => r.x === x && r.y === y);
      if (!room) {
        html += `<div style="width:72px;height:72px"></div>`;
        continue;
      }

      const isCurrent = room.id === state.currentRoomId;
      const currentRoom = getCurrentRoom(state);
      const isAdjacent = !isCurrent && room.discovered && currentRoom?.connections.includes(room.id);
      const cls = [
        'map-cell',
        room.discovered ? 'discovered' : 'undiscovered',
        isCurrent ? 'current' : '',
        room.cleared ? 'cleared' : '',
        isAdjacent ? 'adjacent' : '',
      ].join(' ');

      const click = isAdjacent ? `onclick="gameAction('moveToRoom','${room.id}');gameAction('overlay','none')"` : '';

      html += `
        <div class="${cls}" ${click} style="border-color:${isCurrent ? 'var(--accent-light)' : room.discovered ? getRoomTypeColor(room.type) : 'transparent'}">
          ${room.discovered ? `<div class="map-cell-icon" style="color:${getRoomTypeColor(room.type)}">${icon(room.icon, 22)}</div>` : '?'}
          <div class="map-cell-name">${room.discovered ? room.name : '???'}</div>
          ${isCurrent ? `<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;background:var(--accent-light);border-radius:50%;border:2px solid var(--bg-dark)">${icon('game-icons:mage-staff', 10)}</div>` : ''}
          ${room.cleared ? `<div style="position:absolute;bottom:2px;right:4px;font-size:10px;color:var(--success)">${icon('game-icons:check-mark', 10)}</div>` : ''}
        </div>
      `;
    }
  }
  html += '</div>';

  // Legend
  html += '<div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px">';
  const types = ['combat', 'elite', 'forge', 'rest', 'event', 'merchant', 'boss', 'training'];
  for (const t of types) {
    html += `<span style="color:${getRoomTypeColor(t)}">${icon(getRoomIcon(t), 14)} ${t}</span>`;
  }
  html += '</div>';

  return html;
}

function getRoomIcon(type: string): string {
  const icons: Record<string, string> = {
    combat: 'game-icons:crossed-swords',
    elite: 'game-icons:skull-crossed-bones',
    forge: 'game-icons:anvil',
    rest: 'game-icons:campfire',
    event: 'game-icons:scroll-unfurled',
    merchant: 'game-icons:shop',
    boss: 'game-icons:crowned-skull',
    training: 'game-icons:training',
  };
  return icons[type] || 'game-icons:dungeon-gate';
}

function renderLoadoutOverlay(state: GameState): string {
  const p = state.player;
  let html = '';

  // Spell loadout
  html += '<div class="section-title">Spell Loadout (6 slots)</div>';
  html += '<div class="loadout-grid">';
  for (let i = 0; i < p.equippedSpells.length; i++) {
    const spell = p.equippedSpells[i];
    html += `
      <div class="loadout-slot ${spell ? 'filled' : ''}">
        <div style="font-size:10px;color:var(--text-dim)">Slot ${i + 1}</div>
        ${spell ? `
          <div style="font-size:18px">${icon(getElementIcon(spell.elements[0] as ElementType), 18)}</div>
          <div style="font-weight:600;font-size:11px">${spell.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${spell.damage > 0 ? spell.damage + 'dmg' : ''} ${spell.manaCost}mp</div>
          <button class="btn btn-sm" onclick="gameAction('unequipSpell',${i})" style="margin-top:4px">Remove</button>
        ` : '<div style="color:var(--text-dim);font-size:11px">Empty</div>'}
      </div>
    `;
  }
  html += '</div>';

  // Available spells to equip
  html += '<div class="section-title">Available Spells</div>';
  html += '<div class="forge-grid">';
  for (const spell of p.knownSpells) {
    const equipped = p.equippedSpells.some(s => s?.id === spell.id);
    if (!equipped) {
      const emptySlot = p.equippedSpells.findIndex(s => s === null);
      html += `<div class="spell-card" ${emptySlot >= 0 ? `onclick="gameAction('equipSpell',${emptySlot},'${spell.id}')"` : ''} style="${emptySlot < 0 ? 'opacity:0.5' : ''}">
        <div style="font-size:18px">${icon(getElementIcon(spell.elements[0] as ElementType), 18)}</div>
        <div style="font-weight:600;font-size:11px">${spell.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${spell.damage > 0 ? spell.damage + 'dmg' : ''} ${spell.manaCost}mp</div>
      </div>`;
    }
  }
  html += '</div>';

  // Physical skill loadout
  html += '<div class="section-title">Physical Skill Loadout (4 slots)</div>';
  html += '<div class="loadout-grid">';
  for (let i = 0; i < p.equippedSkills.length; i++) {
    const skill = p.equippedSkills[i];
    html += `
      <div class="loadout-slot ${skill ? 'filled' : ''}">
        <div style="font-size:10px;color:var(--text-dim)">Slot ${i + 1}</div>
        ${skill ? `
          <div style="font-size:18px">${icon('game-icons:sword-brandish', 18)}</div>
          <div style="font-weight:600;font-size:11px">${skill.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${skill.damage > 0 ? skill.damage + 'dmg' : 'Utility'} ${skill.staminaCost}sta</div>
          <button class="btn btn-sm" onclick="gameAction('unequipSkill',${i})" style="margin-top:4px">Remove</button>
        ` : '<div style="color:var(--text-dim);font-size:11px">Empty</div>'}
      </div>
    `;
  }
  html += '</div>';

  // Available skills to equip
  html += '<div class="section-title">Available Skills</div>';
  html += '<div class="forge-grid">';
  for (const skill of p.knownSkills) {
    const equipped = p.equippedSkills.some(s => s?.id === skill.id);
    if (!equipped) {
      const emptySlot = p.equippedSkills.findIndex(s => s === null);
      html += `<div class="spell-card" ${emptySlot >= 0 ? `onclick="gameAction('equipSkill',${emptySlot},'${skill.id}')"` : ''} style="${emptySlot < 0 ? 'opacity:0.5' : ''}">
        <div style="font-size:18px">${icon('game-icons:sword-brandish', 18)}</div>
        <div style="font-weight:600;font-size:11px">${skill.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${skill.damage > 0 ? skill.damage + 'dmg' : 'Utility'} ${skill.staminaCost}sta</div>
      </div>`;
    }
  }
  html += '</div>';

  return html;
}

function renderPoliciesOverlay(state: GameState): string {
  let html = '<p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">Action policies determine how auto-combat resolves. Lower priority number = checked first. Toggle to enable/disable.</p>';

  for (const policy of state.player.actionPolicies.sort((a, b) => a.priority - b.priority)) {
    html += `
      <div class="policy-row">
        <div class="policy-priority">${policy.priority}</div>
        <div class="policy-condition">${icon('game-icons:conversation', 12)} IF ${policy.condition}</div>
        <div class="policy-action">THEN ${policy.action}</div>
        <div class="policy-toggle ${policy.enabled ? 'on' : ''}" onclick="gameAction('togglePolicy','${policy.id}')"></div>
      </div>
    `;
  }

  html += `<p style="color:var(--text-dim);margin-top:16px;font-size:11px">
    Policies are evaluated top-to-bottom. The first matching enabled policy determines the action.
    If no policy matches, a basic attack is used.
  </p>`;

  return html;
}

function renderNotifications(state: GameState): string {
  if (state.notifications.length === 0) return '';
  let html = '<div class="notifications">';
  for (const notif of state.notifications) {
    html += `<div class="notif notif-${notif.type}">${notif.text}</div>`;
  }
  html += '</div>';
  return html;
}

function renderGameOver(state: GameState): string {
  return `
    <div class="end-screen">
      <div style="font-size:64px;margin-bottom:20px">${icon('game-icons:skull', 64)}</div>
      <h1 style="color:var(--danger)">Defeated</h1>
      <div class="stats">
        <p>Level: ${state.player.level} | Floor: ${state.floors[state.currentFloor].name}</p>
        <p>Room transitions: ${state.roomTransitions}</p>
        <p>Spells crafted: ${state.player.knownSpells.filter(s => s.isCrafted).length}</p>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn btn-primary btn-lg" onclick="gameAction('continue')">${icon('game-icons:save', 18)} Load Checkpoint</button>
        <button class="btn btn-lg" onclick="gameAction('newGame')">${icon('game-icons:crossed-swords', 18)} New Game</button>
        <button class="btn btn-lg" onclick="gameAction('backToTitle')">Title Screen</button>
      </div>
    </div>
  `;
}

function renderVictory(state: GameState): string {
  return `
    <div class="end-screen">
      <div style="font-size:64px;margin-bottom:20px">${icon('game-icons:trophy', 64)}</div>
      <h1 style="background:linear-gradient(135deg, var(--gold), var(--accent-light));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">Dungeon Escaped!</h1>
      <div class="stats">
        <p>Level: ${state.player.level}</p>
        <p>Room transitions: ${state.roomTransitions}</p>
        <p>Spells crafted: ${state.player.knownSpells.filter(s => s.isCrafted).length}</p>
        <p>Runes discovered: ${state.player.discoveredRunes.filter(r => r.discovered).length}/${state.player.discoveredRunes.length}</p>
        <p>Skills unlocked: ${state.player.skillTree.filter(n => n.unlocked).length}/${state.player.skillTree.length}</p>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn btn-primary btn-lg" onclick="gameAction('newGame')">${icon('game-icons:crossed-swords', 18)} New Game</button>
        <button class="btn btn-lg" onclick="gameAction('backToTitle')">Title Screen</button>
      </div>
    </div>
  `;
}

// Keyboard shortcut handling
export function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (overlayScreen !== 'none') {
        overlayScreen = 'none';
        render();
      }
    }
    if (e.key === 'm' || e.key === 'M') {
      if (overlayScreen === 'none') {
        overlayScreen = 'map';
        render();
      }
    }
    if (e.key === 'i' || e.key === 'I') {
      if (overlayScreen === 'none') {
        overlayScreen = 'inventory';
        render();
      }
    }
    if (e.key === 'c' || e.key === 'C') {
      if (overlayScreen === 'none') {
        overlayScreen = 'character';
        render();
      }
    }
  });
}
