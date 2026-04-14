import type { GameState, FloorData, RoomData, ViewName, SpellData, EquipmentItem, RuneItem, CombatState } from './types';
import { getCurrentFloor, getCurrentRoom, getEffectiveStats, saveGame, checkLevelUp } from './state';
import { initCombat, executeTurn } from './combat';

export class UI {
  private root: HTMLElement;
  private state!: GameState;
  private onStateChange?: () => void;
  private combatTimer: number | null = null;
  private forgeSelection: string[] = [];
  private dialogueResponse: string | null = null;
  private dialogueChosenIdx: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  setState(state: GameState, onStateChange?: () => void) {
    this.state = state;
    this.onStateChange = onStateChange;
    this.render();
  }

  render() {
    if (this.combatTimer) {
      clearTimeout(this.combatTimer);
      this.combatTimer = null;
    }

    switch (this.state.view) {
      case 'title': return this.renderTitle();
      case 'game': return this.renderGame();
      case 'combatSetup': return this.renderCombatSetup();
      case 'combat': return this.renderCombat();
      case 'merchant': return this.renderMerchant();
      case 'dialogue': return this.renderDialogue();
      case 'forge': return this.renderForge();
      case 'inventory': return this.renderInventory();
      case 'character': return this.renderCharacter();
      case 'map': return this.renderMap();
      case 'victory': return this.renderVictory();
      case 'defeat': return this.renderDefeat();
    }
  }

  private bind() {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handle(el.dataset.action!, el);
      });
    });
    // Bind select elements
    this.root.querySelectorAll<HTMLSelectElement>('[data-spell-slot]').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.spellSlot!);
        this.state.player.loadout.spellSlots[idx] = sel.value || null;
        this.render();
      });
    });
    // Bind range inputs
    this.root.querySelectorAll<HTMLInputElement>('[data-policy-range]').forEach(inp => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.policyRange!;
        (this.state.player.combatPolicy as any)[key] = parseInt(inp.value);
        this.render();
      });
    });
  }

  private handle(action: string, el: HTMLElement) {
    const s = this.state;

    if (action === 'navigate') {
      const roomId = el.dataset.room!;
      this.navigateTo(roomId);
    } else if (action === 'enter-combat') {
      s.view = 'combatSetup';
      const room = getCurrentRoom(s);
      if (room?.enemy) {
        s.combat = initCombat(s, room.enemy);
      }
      this.render();
    } else if (action === 'start-auto-combat') {
      if (s.combat) {
        s.combat.phase = 'running';
        s.combat.autoRunning = true;
        s.view = 'combat';
        this.render();
        this.runAutoCombat();
      }
    } else if (action === 'pause-combat') {
      if (s.combat) {
        s.combat.phase = 'paused';
        s.combat.autoRunning = false;
      }
      this.render();
    } else if (action === 'resume-combat') {
      if (s.combat) {
        s.combat.phase = 'running';
        s.combat.autoRunning = true;
        this.render();
        this.runAutoCombat();
      }
    } else if (action === 'collect-loot') {
      this.collectLoot();
    } else if (action === 'return-to-room') {
      s.combat = null;
      s.view = 'game';
      saveGame(s);
      this.render();
    } else if (action === 'open-merchant') {
      s.view = 'merchant';
      this.render();
    } else if (action === 'buy-item') {
      const itemId = el.dataset.itemId!;
      this.buyItem(itemId);
    } else if (action === 'open-dialogue') {
      s.view = 'dialogue';
      this.dialogueResponse = null;
      this.dialogueChosenIdx = null;
      this.render();
    } else if (action === 'dialogue-choice') {
      const idx = parseInt(el.dataset.choiceIdx!);
      this.handleDialogueChoice(idx);
    } else if (action === 'open-forge') {
      s.view = 'forge';
      this.forgeSelection = [];
      this.render();
    } else if (action === 'toggle-rune') {
      const element = el.dataset.element!;
      if (this.forgeSelection.includes(element)) {
        this.forgeSelection = this.forgeSelection.filter(e => e !== element);
      } else if (this.forgeSelection.length < 2) {
        this.forgeSelection.push(element);
      }
      this.render();
    } else if (action === 'craft-spell') {
      this.craftSpell();
    } else if (action === 'back-to-game') {
      s.view = 'game';
      this.render();
    } else if (action === 'open-inventory') {
      s.view = 'inventory';
      this.render();
    } else if (action === 'open-character') {
      s.view = 'character';
      this.render();
    } else if (action === 'open-map') {
      s.view = 'map';
      this.render();
    } else if (action === 'equip-item') {
      const itemId = el.dataset.itemId!;
      this.equipItem(itemId);
    } else if (action === 'use-item') {
      const itemId = el.dataset.itemId!;
      this.useConsumable(itemId);
    } else if (action === 'unequip-item') {
      const slot = el.dataset.slot!;
      this.unequipItem(slot);
    } else if (action === 'unlock-skill') {
      const skillId = el.dataset.skillId!;
      this.unlockSkill(skillId);
    } else if (action === 'toggle-policy') {
      const key = el.dataset.policyKey! as keyof typeof s.player.combatPolicy;
      (s.player.combatPolicy as any)[key] = !(s.player.combatPolicy as any)[key];
      this.render();
    } else if (action === 'next-floor') {
      const room = getCurrentRoom(s);
      if (room?.bossGateToFloor) {
        if (room.bossGateToFloor === 'victory') {
          s.view = 'victory';
        } else {
          s.currentFloorId = room.bossGateToFloor;
          const nextFloor = getCurrentFloor(s);
          if (nextFloor) {
            s.currentRoomId = nextFloor.rooms[0].id;
            s.visitedRooms.push(s.currentRoomId);
          }
          s.view = 'game';
        }
        saveGame(s);
        this.render();
      }
    } else if (action === 'new-game-from-defeat') {
      // Reset handled by main.ts callback
      this.onStateChange?.();
    } else if (action === 'map-navigate') {
      const roomId = el.dataset.room!;
      if (s.visitedRooms.includes(roomId)) {
        this.navigateTo(roomId);
        s.view = 'game';
        this.render();
      }
    }
  }

  private navigateTo(roomId: string) {
    const s = this.state;
    s.currentRoomId = roomId;
    if (!s.visitedRooms.includes(roomId)) {
      s.visitedRooms.push(roomId);
    }
    s.hungerLevel += 1; // pressure: hunger increases on movement
    s.view = 'game';
    saveGame(s);
    this.render();
  }

  private runAutoCombat() {
    if (!this.state.combat || !this.state.combat.autoRunning) return;
    if (this.state.combat.phase !== 'running') return;

    executeTurn(this.state, this.state.combat);
    this.render();

    if (this.state.combat.phase === 'running') {
      this.combatTimer = window.setTimeout(() => this.runAutoCombat(), 800);
    }
  }

  private collectLoot() {
    const s = this.state;
    const room = getCurrentRoom(s);
    if (!room?.enemy || !s.combat) return;

    const enemy = room.enemy;
    s.player.xp += enemy.xpReward;
    s.player.gold += enemy.goldReward;

    // Process loot
    for (const loot of enemy.loot) {
      if (Math.random() > loot.chance) continue;
      if (loot.type === 'rune' && loot.id) {
        const runeData = s.runesData.find(r => r.id === loot.id);
        if (runeData && !s.player.runes.some(r => r.id === loot.id)) {
          s.player.runes.push({
            id: runeData.id,
            name: runeData.name,
            type: 'rune',
            icon: runeData.icon,
            element: runeData.element,
          });
        }
      } else if (loot.type === 'equipment' && loot.value) {
        s.player.inventory.push(loot.value);
      }
    }

    s.clearedRooms.push(s.currentRoomId);
    const leveled = checkLevelUp(s);
    s.combat = null;
    s.view = 'game';
    saveGame(s);
    this.render();
  }

  private buyItem(itemId: string) {
    const s = this.state;
    const room = getCurrentRoom(s);
    if (!room?.merchant) return;
    const item = room.merchant.inventory.find(i => i.id === itemId);
    if (!item || s.player.gold < item.cost) return;

    s.player.gold -= item.cost;
    if (item.type === 'consumable') {
      s.player.inventory.push({
        id: item.id, name: item.name, type: 'consumable',
        icon: item.icon, effect: item.effect!
      });
    } else if (item.type === 'equipment') {
      s.player.inventory.push({
        id: item.id, name: item.name, type: 'equipment',
        slot: item.slot!, icon: item.icon, stats: item.stats!
      });
    }
    saveGame(s);
    this.render();
  }

  private handleDialogueChoice(idx: number) {
    const s = this.state;
    const room = getCurrentRoom(s);
    if (!room?.npc) return;
    const branch = room.npc.branches[idx];
    if (!branch) return;

    this.dialogueChosenIdx = idx;
    this.dialogueResponse = branch.response;

    // Apply trait shifts
    for (const [trait, shift] of Object.entries(branch.traitShift)) {
      s.player.traits[trait] = Math.max(0, Math.min(1, (s.player.traits[trait] || 0) + shift));
    }

    // Apply reward
    if (branch.reward) {
      if (branch.reward.type === 'item' && branch.reward.value) {
        const item = branch.reward.value;
        if (item.type === 'rune') {
          if (!s.player.runes.some(r => r.id === item.id)) {
            s.player.runes.push(item);
          }
        } else {
          s.player.inventory.push(item);
        }
      } else if (branch.reward.type === 'xp') {
        s.player.xp += branch.reward.value;
        checkLevelUp(s);
      }
    }

    s.dialogueChoicesMade[room.id] = idx;
    saveGame(s);
    this.render();
  }

  private craftSpell() {
    const s = this.state;
    if (this.forgeSelection.length !== 2) return;

    const sorted = [...this.forgeSelection].sort();
    const recipe = s.recipesData.find(r => {
      const rSorted = [...r.elements].sort();
      return rSorted[0] === sorted[0] && rSorted[1] === sorted[1];
    });

    if (recipe && !s.player.spells.some(sp => sp.id === recipe.id)) {
      const newSpell: SpellData = {
        id: recipe.id,
        name: recipe.name,
        icon: recipe.icon,
        manaCost: recipe.manaCost,
        description: recipe.description,
        effect: recipe.effect,
        isCrafted: true,
        affinityUses: 0,
      };
      s.player.spells.push(newSpell);
      if (!s.player.discoveredRecipes.includes(recipe.id)) {
        s.player.discoveredRecipes.push(recipe.id);
      }
      // Auto-equip to first empty slot
      const emptySlot = s.player.loadout.spellSlots.indexOf(null);
      if (emptySlot >= 0) {
        s.player.loadout.spellSlots[emptySlot] = recipe.id;
      }
      saveGame(s);
    }

    this.render();
  }

  private equipItem(itemId: string) {
    const s = this.state;
    const idx = s.player.inventory.findIndex(i => i.id === itemId && i.type === 'equipment');
    if (idx < 0) return;
    const item = s.player.inventory[idx] as EquipmentItem;

    // Unequip current
    const current = s.player.equipment[item.slot];
    if (current) {
      s.player.inventory.push(current);
    }
    s.player.equipment[item.slot] = item;
    s.player.inventory.splice(idx, 1);
    saveGame(s);
    this.render();
  }

  private unequipItem(slot: string) {
    const s = this.state;
    const item = s.player.equipment[slot];
    if (!item) return;
    s.player.inventory.push(item);
    s.player.equipment[slot] = null;
    saveGame(s);
    this.render();
  }

  private useConsumable(itemId: string) {
    const s = this.state;
    const idx = s.player.inventory.findIndex(i => i.id === itemId && i.type === 'consumable');
    if (idx < 0) return;
    const item = s.player.inventory[idx];
    if (item.type !== 'consumable') return;

    const stats = getEffectiveStats(s);
    if (item.effect.heal) {
      s.player.hp = Math.min(stats.maxHp, s.player.hp + item.effect.heal);
    }
    if (item.effect.restoreMana) {
      s.player.mana = Math.min(stats.maxMana, s.player.mana + item.effect.restoreMana);
    }
    s.player.inventory.splice(idx, 1);
    saveGame(s);
    this.render();
  }

  private unlockSkill(skillId: string) {
    const s = this.state;
    const node = s.skillTreeData.find(n => n.id === skillId);
    if (!node) return;
    if (s.player.unlockedSkills.includes(skillId)) return;
    if (s.player.skillPoints < node.cost) return;
    if (node.requires.some(req => !s.player.unlockedSkills.includes(req))) return;

    s.player.skillPoints -= node.cost;
    s.player.unlockedSkills.push(skillId);

    // Apply immediate stat effects
    const stats = getEffectiveStats(s);
    s.player.hp = Math.min(s.player.hp, stats.maxHp);
    s.player.mana = Math.min(s.player.mana, stats.maxMana);

    saveGame(s);
    this.render();
  }

  // ====== RENDER METHODS ======

  private renderTitle() {
    this.root.innerHTML = `
      <div class="title-screen">
        <iconify-icon class="title-icon" icon="game-icons:dungeon-gate" width="80"></iconify-icon>
        <h1>Escape the Dungeon</h1>
        <p class="subtitle">Craft your spells. Configure your tactics. Survive.</p>
        <div class="title-buttons">
          <button class="btn btn-primary" data-action="new-game-from-defeat">
            <iconify-icon icon="game-icons:sword-brandish"></iconify-icon> New Game
          </button>
        </div>
      </div>
    `;
    this.bind();
  }

  private renderTopBar(): string {
    const s = this.state;
    const stats = getEffectiveStats(s);
    const floor = getCurrentFloor(s);
    const hpPct = Math.max(0, (s.player.hp / stats.maxHp) * 100);
    const manaPct = Math.max(0, (s.player.mana / stats.maxMana) * 100);
    const xpPct = (s.player.xp / s.player.xpToNext) * 100;
    const hungerPct = Math.min(100, s.player.hungerLevel);

    return `
      <div class="top-bar">
        <span class="floor-name">
          <iconify-icon icon="game-icons:stairs"></iconify-icon> ${floor?.name || 'Unknown'}
        </span>
        <div class="stat-group">
          <iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon>
          <span>${s.player.hp}/${stats.maxHp}</span>
          <div class="bar-container"><div class="bar-fill bar-hp" style="width:${hpPct}%"></div></div>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:crystal-ball" style="color:var(--mana)"></iconify-icon>
          <span>${s.player.mana}/${stats.maxMana}</span>
          <div class="bar-container"><div class="bar-fill bar-mana" style="width:${manaPct}%"></div></div>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:level-end-flag" style="color:var(--gold)"></iconify-icon>
          <span>Lv.${s.player.level}</span>
          <div class="bar-container"><div class="bar-fill bar-xp" style="width:${xpPct}%"></div></div>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:coins" style="color:var(--gold)"></iconify-icon>
          <span>${s.player.gold}g</span>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:meal" style="color:var(--fire)"></iconify-icon>
          <span>Hunger</span>
          <div class="bar-container"><div class="bar-fill bar-hunger" style="width:${hungerPct}%"></div></div>
        </div>
      </div>
    `;
  }

  private renderSidebar(): string {
    const s = this.state;
    const floor = getCurrentFloor(s);

    let traitsHtml = '';
    for (const [trait, val] of Object.entries(s.player.traits)) {
      const pct = val * 100;
      traitsHtml += `
        <div class="trait-row">
          <span>${trait}</span>
          <div class="trait-bar-bg">
            <div class="trait-bar-fill trait-${trait}" style="width:${pct}%"></div>
          </div>
          <span class="trait-value">${val.toFixed(2)}</span>
        </div>
      `;
    }

    let affinityHtml = '';
    const affinities = Object.entries(s.player.affinities);
    if (affinities.length > 0) {
      affinityHtml = `<div class="panel"><h3><iconify-icon icon="game-icons:magic-swirl"></iconify-icon> Affinities</h3><div class="affinity-list">`;
      for (const [elem, count] of affinities) {
        affinityHtml += `<div class="affinity-row"><span class="element-${elem}">${elem}</span><span>${count} casts</span></div>`;
      }
      affinityHtml += `</div></div>`;
    }

    return `
      <div class="sidebar">
        <div class="panel">
          <h3><iconify-icon icon="game-icons:compass"></iconify-icon> Navigation</h3>
          <div class="nav-buttons">
            <button class="btn btn-small" data-action="open-inventory">
              <iconify-icon icon="game-icons:knapsack"></iconify-icon> Inventory
            </button>
            <button class="btn btn-small" data-action="open-character">
              <iconify-icon icon="game-icons:character"></iconify-icon> Character
            </button>
            <button class="btn btn-small" data-action="open-map">
              <iconify-icon icon="game-icons:treasure-map"></iconify-icon> Map
            </button>
          </div>
        </div>
        <div class="panel">
          <h3><iconify-icon icon="game-icons:brain"></iconify-icon> Traits</h3>
          ${traitsHtml}
        </div>
        ${affinityHtml}
        ${floor ? `<div class="panel pressure-panel">
          <div class="floor-pressure-note">
            <iconify-icon icon="game-icons:alert"></iconify-icon>
            ${floor.pressure_note}
          </div>
        </div>` : ''}
      </div>
    `;
  }

  private renderGame() {
    const s = this.state;
    const room = getCurrentRoom(s);
    const floor = getCurrentFloor(s);
    if (!room || !floor) return;

    const isCleared = s.clearedRooms.includes(room.id);
    const hasDialogued = s.dialogueChoicesMade[room.id] !== undefined;

    let roomActions = '';

    if (room.type === 'combat' || room.type === 'boss') {
      if (!isCleared) {
        roomActions = `
          <div style="margin-top:12px">
            <button class="btn btn-danger" data-action="enter-combat">
              <iconify-icon icon="game-icons:crossed-swords"></iconify-icon> Engage ${room.enemy?.name || 'Enemy'}
            </button>
          </div>
        `;
      } else if (room.bossGateToFloor) {
        roomActions = `
          <div style="margin-top:12px">
            <button class="btn btn-primary" data-action="next-floor">
              <iconify-icon icon="game-icons:stairs"></iconify-icon> Descend to Next Floor
            </button>
          </div>
        `;
      } else {
        roomActions = `<p style="color:var(--nature);margin-top:8px"><iconify-icon icon="game-icons:check-mark"></iconify-icon> Room cleared</p>`;
      }
    } else if (room.type === 'merchant') {
      roomActions = `
        <div style="margin-top:12px">
          <button class="btn" data-action="open-merchant">
            <iconify-icon icon="game-icons:trade"></iconify-icon> Browse Wares
          </button>
        </div>
      `;
    } else if (room.type === 'dialogue') {
      if (!hasDialogued) {
        roomActions = `
          <div style="margin-top:12px">
            <button class="btn" data-action="open-dialogue">
              <iconify-icon icon="game-icons:talk"></iconify-icon> Speak with ${room.npc?.name || 'NPC'}
            </button>
          </div>
        `;
      } else {
        roomActions = `<p style="color:var(--text-dim);margin-top:8px"><iconify-icon icon="game-icons:check-mark"></iconify-icon> Already spoken</p>`;
      }
    } else if (room.type === 'forge') {
      roomActions = `
        <div style="margin-top:12px">
          <button class="btn" data-action="open-forge">
            <iconify-icon icon="game-icons:anvil"></iconify-icon> Use the Runforge
          </button>
        </div>
      `;
    }

    // Build exits
    let exitsHtml = '<div class="exits-list">';
    for (const exitId of room.exits) {
      const exitRoom = floor.rooms.find(r => r.id === exitId);
      if (exitRoom) {
        const visited = s.visitedRooms.includes(exitId);
        const cleared = s.clearedRooms.includes(exitId);
        exitsHtml += `
          <button class="btn btn-small" data-action="navigate" data-room="${exitId}">
            <iconify-icon icon="${exitRoom.icon}"></iconify-icon>
            ${exitRoom.name}
            ${cleared ? '<iconify-icon icon="game-icons:check-mark" style="color:var(--nature);font-size:0.8em"></iconify-icon>' : ''}
          </button>
        `;
      }
    }
    exitsHtml += '</div>';

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="${room.icon}" width="48"></iconify-icon>
              <div>
                <h2>${room.name} <span class="room-type-badge type-${room.type}">${room.type}</span></h2>
              </div>
            </div>
            <p class="room-description">${room.description}</p>
            ${roomActions}
          </div>
          <div class="panel">
            <h3><iconify-icon icon="game-icons:doorway"></iconify-icon> Exits</h3>
            ${exitsHtml}
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderCombatSetup() {
    const s = this.state;
    const combat = s.combat;
    if (!combat) return;

    const policy = s.player.combatPolicy;

    // Loadout slots
    let slotsHtml = '';
    for (let i = 0; i < 4; i++) {
      const currentId = s.player.loadout.spellSlots[i];
      let options = '<option value="">-- empty --</option>';
      for (const spell of s.player.spells) {
        const selected = spell.id === currentId ? 'selected' : '';
        options += `<option value="${spell.id}" ${selected}>${spell.name} (${spell.manaCost} MP)</option>`;
      }
      slotsHtml += `
        <div class="spell-slot">
          <span>Slot ${i + 1}:</span>
          <select data-spell-slot="${i}">${options}</select>
        </div>
      `;
    }

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:battle-gear"></iconify-icon> Combat Setup</h2>
            <p style="color:var(--text-dim);margin-bottom:16px">Configure your loadout and action policies before engaging. Combat will auto-resolve based on your build.</p>

            <div class="combatants" style="margin-bottom:16px">
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="game-icons:knight-helmet" style="color:var(--arcane)"></iconify-icon>
                <div><strong>You</strong></div>
                <div style="font-size:0.85rem;color:var(--text-dim)">Lv.${s.player.level}</div>
              </div>
              <div class="vs-divider">VS</div>
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="${combat.enemy.icon}" style="color:var(--danger)"></iconify-icon>
                <div><strong>${combat.enemy.name}</strong></div>
                <div style="font-size:0.85rem;color:var(--text-dim)">
                  HP: ${combat.enemy.hp} | ATK: ${combat.enemy.attack} | DEF: ${combat.enemy.defense}
                </div>
                <div class="enemy-traits">
                  ${Object.entries(combat.enemy.traits).map(([k, v]) => `<span>${k}: ${(v as number).toFixed(1)}</span>`).join(' | ')}
                </div>
                ${combat.enemy.directResist > 0 ? `<div style="font-size:0.8rem;color:var(--fire)">Direct Resist: ${Math.round(combat.enemy.directResist * 100)}%</div>` : ''}
                ${combat.enemy.reflectDamage > 0 ? `<div style="font-size:0.8rem;color:var(--shadow)">Reflects: ${Math.round(combat.enemy.reflectDamage * 100)}% damage</div>` : ''}
                ${combat.enemy.manaDrainPerTurn ? `<div style="font-size:0.8rem;color:var(--mana)">Mana Drain: ${combat.enemy.manaDrainPerTurn}/turn</div>` : ''}
              </div>
            </div>

            <div class="setup-section">
              <h3><iconify-icon icon="game-icons:spell-book"></iconify-icon> Spell Loadout</h3>
              <div class="spell-slot-grid">${slotsHtml}</div>
            </div>

            <div class="setup-section">
              <h3><iconify-icon icon="game-icons:cog"></iconify-icon> Action Policies</h3>
              <div class="policy-grid">
                <div class="policy-toggle ${policy.preferDot ? 'active' : ''}" data-action="toggle-policy" data-policy-key="preferDot">
                  <iconify-icon icon="game-icons:poison-cloud"></iconify-icon> Prefer DoT Spells
                </div>
                <div class="policy-toggle ${policy.useForgeSpells ? 'active' : ''}" data-action="toggle-policy" data-policy-key="useForgeSpells">
                  <iconify-icon icon="game-icons:anvil"></iconify-icon> Use Crafted Spells
                </div>
                <div class="policy-toggle ${policy.conserveMana ? 'active' : ''}" data-action="toggle-policy" data-policy-key="conserveMana">
                  <iconify-icon icon="game-icons:crystal-ball"></iconify-icon> Conserve Mana
                </div>
              </div>
              <div class="threshold-control" style="margin-top:8px">
                <iconify-icon icon="game-icons:health-increase" style="color:var(--heal)"></iconify-icon>
                <span>Heal at HP%:</span>
                <input type="range" min="10" max="60" value="${policy.lowHpThreshold}" data-policy-range="lowHpThreshold" />
                <span>${policy.lowHpThreshold}%</span>
              </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px">
              <button class="btn btn-primary" data-action="start-auto-combat">
                <iconify-icon icon="game-icons:sword-clash"></iconify-icon> Begin Auto-Combat
              </button>
              <button class="btn" data-action="return-to-room">
                <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Retreat
              </button>
            </div>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderCombat() {
    const s = this.state;
    const combat = s.combat;
    if (!combat) return;

    const stats = getEffectiveStats(s);
    const hpPct = Math.max(0, (s.player.hp / stats.maxHp) * 100);
    const manaPct = Math.max(0, (s.player.mana / stats.maxMana) * 100);
    const enemyHpPct = Math.max(0, (combat.enemy.hp / combat.enemy.maxHp) * 100);

    // Status effects
    let enemyStatuses = '';
    for (const eff of combat.enemy.statusEffects) {
      enemyStatuses += `<span class="status-chip element-${eff.element || ''}">${eff.kind} (${eff.dmgPerTurn}/t, ${eff.turns}t)</span>`;
    }

    let playerStatuses = '';
    if (combat.playerShield) {
      playerStatuses += `<span class="status-chip" style="color:var(--arcane)">Shield (${combat.playerShield.absorb} abs, ${combat.playerShield.turns}t)</span>`;
    }
    if (combat.playerBuff) {
      playerStatuses += `<span class="status-chip" style="color:var(--gold)">Buff (+${combat.playerBuff.spellPower} SP, ${combat.playerBuff.turns}t)</span>`;
    }

    // Log
    const recentLog = combat.log.slice(-15);
    let logHtml = '';
    for (const entry of recentLog) {
      const cls = entry.actor === 'player' ? 'log-player' : entry.actor === 'enemy' ? 'log-enemy' : `log-${entry.type}`;
      logHtml += `<div class="log-entry ${cls}">${entry.text}</div>`;
    }

    let controlsHtml = '';
    if (combat.phase === 'running') {
      controlsHtml = `<button class="btn btn-danger" data-action="pause-combat"><iconify-icon icon="game-icons:pause-button"></iconify-icon> Pause</button>`;
    } else if (combat.phase === 'paused') {
      controlsHtml = `
        <button class="btn btn-primary" data-action="resume-combat"><iconify-icon icon="game-icons:play-button"></iconify-icon> Resume</button>
        <button class="btn" data-action="return-to-room"><iconify-icon icon="game-icons:return-arrow"></iconify-icon> Flee</button>
      `;
    } else if (combat.phase === 'victory') {
      controlsHtml = `<button class="btn btn-primary" data-action="collect-loot"><iconify-icon icon="game-icons:open-treasure-chest"></iconify-icon> Collect Loot & Continue</button>`;
    } else if (combat.phase === 'defeat') {
      controlsHtml = `<button class="btn btn-danger" data-action="new-game-from-defeat"><iconify-icon icon="game-icons:skull"></iconify-icon> Game Over</button>`;
    }

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel combat-layout">
            <h2><iconify-icon icon="game-icons:crossed-swords"></iconify-icon> Combat - Turn ${combat.turn}</h2>
            <div class="combatants">
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="game-icons:knight-helmet" style="color:var(--arcane)" width="48"></iconify-icon>
                <div><strong>You</strong></div>
                <div class="stat-group" style="justify-content:center">
                  <iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon>
                  ${s.player.hp}/${stats.maxHp}
                  <div class="bar-container" style="width:80px"><div class="bar-fill bar-hp" style="width:${hpPct}%"></div></div>
                </div>
                <div class="stat-group" style="justify-content:center">
                  <iconify-icon icon="game-icons:crystal-ball" style="color:var(--mana)"></iconify-icon>
                  ${s.player.mana}/${stats.maxMana}
                  <div class="bar-container" style="width:80px"><div class="bar-fill bar-mana" style="width:${manaPct}%"></div></div>
                </div>
                <div class="status-effects">${playerStatuses}</div>
              </div>
              <div class="vs-divider">VS</div>
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="${combat.enemy.icon}" style="color:var(--danger)" width="48"></iconify-icon>
                <div><strong>${combat.enemy.name}</strong></div>
                <div class="stat-group" style="justify-content:center">
                  <iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon>
                  ${combat.enemy.hp}/${combat.enemy.maxHp}
                  <div class="bar-container" style="width:80px"><div class="bar-fill bar-hp" style="width:${enemyHpPct}%"></div></div>
                </div>
                <div class="enemy-traits">
                  ${Object.entries(combat.enemy.traits).map(([k, v]) => `<span>${k}: ${(v as number).toFixed(1)}</span>`).join(' | ')}
                </div>
                <div class="status-effects">${enemyStatuses}</div>
              </div>
            </div>

            <div class="combat-log" id="combat-log">${logHtml}</div>

            <div class="combat-controls">${controlsHtml}</div>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;

    // Auto-scroll log
    const logEl = document.getElementById('combat-log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;

    this.bind();
  }

  private renderMerchant() {
    const s = this.state;
    const room = getCurrentRoom(s);
    if (!room?.merchant) return;
    const merchant = room.merchant;

    let itemsHtml = '';
    for (const item of merchant.inventory) {
      const canBuy = s.player.gold >= item.cost;
      const alreadyOwned = s.player.inventory.some(i => i.id === item.id) ||
        Object.values(s.player.equipment).some(e => e?.id === item.id);

      let descParts: string[] = [];
      if (item.effect) descParts.push(Object.entries(item.effect).map(([k, v]) => `${k}: +${v}`).join(', '));
      if (item.stats) descParts.push(Object.entries(item.stats).map(([k, v]) => `${k}: +${v}`).join(', '));

      itemsHtml += `
        <div class="shop-item">
          <iconify-icon icon="${item.icon}" style="font-size:1.5rem;color:var(--gold)"></iconify-icon>
          <div class="shop-item-info">
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${descParts.join(', ')}</div>
          </div>
          <div class="shop-price">
            <iconify-icon icon="game-icons:coins"></iconify-icon> ${item.cost}g
          </div>
          <button class="btn btn-small" data-action="buy-item" data-item-id="${item.id}" ${!canBuy || alreadyOwned ? 'disabled' : ''}>
            ${alreadyOwned ? 'Owned' : 'Buy'}
          </button>
        </div>
      `;
    }

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="${merchant.icon}" width="48" style="color:var(--gold)"></iconify-icon>
              <div>
                <h2>${merchant.name}</h2>
                <span class="room-type-badge type-merchant">Merchant</span>
              </div>
            </div>
            <p style="color:var(--text-dim);margin-bottom:16px">Your gold: <span style="color:var(--gold);font-weight:600">${s.player.gold}g</span></p>
            ${itemsHtml}
            <button class="btn" data-action="back-to-game" style="margin-top:12px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Leave Shop
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderDialogue() {
    const s = this.state;
    const room = getCurrentRoom(s);
    if (!room?.npc) return;
    const npc = room.npc;

    let choicesHtml = '';
    for (let i = 0; i < npc.branches.length; i++) {
      const branch = npc.branches[i];
      const isChosen = this.dialogueChosenIdx === i;
      const disabled = this.dialogueChosenIdx !== null && !isChosen;
      choicesHtml += `
        <button class="dialogue-choice ${isChosen ? 'chosen' : ''}" data-action="dialogue-choice" data-choice-idx="${i}" ${disabled ? 'disabled' : ''}>
          ${branch.text}
          ${branch.traitShift ? `<span style="font-size:0.75rem;color:var(--text-dim)"> (${Object.entries(branch.traitShift).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')})</span>` : ''}
        </button>
      `;
    }

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="${npc.icon}" width="48" style="color:var(--nature)"></iconify-icon>
              <div>
                <h2>${npc.name}</h2>
                <span class="room-type-badge type-dialogue">Dialogue</span>
              </div>
            </div>
            <div class="npc-greeting">"${npc.greeting}"</div>
            ${choicesHtml}
            ${this.dialogueResponse ? `<div class="dialogue-response">"${this.dialogueResponse}"</div>` : ''}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Leave
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderForge() {
    const s = this.state;

    // Get unique elements from player's runes
    const uniqueElements = [...new Set(s.player.runes.map(r => r.element))];

    let runesHtml = '';
    for (const elem of uniqueElements) {
      const rune = s.player.runes.find(r => r.element === elem)!;
      const selected = this.forgeSelection.includes(elem);
      runesHtml += `
        <div class="rune-chip ${selected ? 'selected' : ''} element-${elem}" data-action="toggle-rune" data-element="${elem}">
          <iconify-icon icon="${rune.icon}"></iconify-icon> ${rune.name}
        </div>
      `;
    }

    // Check recipe
    let recipeHtml = '';
    if (this.forgeSelection.length === 2) {
      const sorted = [...this.forgeSelection].sort();
      const recipe = s.recipesData.find(r => {
        const rSorted = [...r.elements].sort();
        return rSorted[0] === sorted[0] && rSorted[1] === sorted[1];
      });

      if (recipe) {
        const alreadyCrafted = s.player.spells.some(sp => sp.id === recipe.id);
        recipeHtml = `
          <div class="recipe-result found">
            <iconify-icon icon="${recipe.icon}" style="font-size:2rem;color:var(--gold)"></iconify-icon>
            <div class="recipe-name">${recipe.name}</div>
            <p style="font-size:0.85rem;color:var(--text-dim);margin:6px 0">${recipe.description}</p>
            <p style="font-size:0.8rem">Mana Cost: ${recipe.manaCost} | Effect: ${recipe.effect.type}${recipe.effect.damage ? ` (${recipe.effect.damage} dmg)` : ''}</p>
            ${alreadyCrafted
              ? '<p style="color:var(--nature);margin-top:8px">Already crafted!</p>'
              : `<button class="btn btn-primary" data-action="craft-spell" style="margin-top:8px"><iconify-icon icon="game-icons:anvil"></iconify-icon> Craft Spell</button>`
            }
          </div>
        `;
      } else {
        recipeHtml = `<div class="recipe-result"><p style="color:var(--text-dim)">No recipe found for this combination.</p></div>`;
      }
    }

    // Show known recipes
    let knownHtml = '';
    if (s.player.discoveredRecipes.length > 0) {
      knownHtml = '<div style="margin-top:16px"><h3>Crafted Spells</h3>';
      for (const rid of s.player.discoveredRecipes) {
        const r = s.recipesData.find(x => x.id === rid);
        if (r) {
          knownHtml += `
            <div class="shop-item">
              <iconify-icon icon="${r.icon}" style="font-size:1.3rem;color:var(--gold)"></iconify-icon>
              <div class="shop-item-info">
                <div class="shop-item-name">${r.name}</div>
                <div class="shop-item-desc">${r.description}</div>
              </div>
            </div>
          `;
        }
      }
      knownHtml += '</div>';
    }

    // Show all possible recipes as hints
    let hintHtml = '<div style="margin-top:16px"><h3><iconify-icon icon="game-icons:spell-book"></iconify-icon> Recipe Hints</h3>';
    for (const recipe of s.recipesData) {
      const hasElements = recipe.elements.every(e => uniqueElements.includes(e));
      const crafted = s.player.discoveredRecipes.includes(recipe.id);
      hintHtml += `
        <div style="padding:6px 0;font-size:0.85rem;color:${hasElements ? 'var(--text)' : 'var(--text-dim)'}">
          <iconify-icon icon="${recipe.icon}"></iconify-icon>
          ${crafted ? recipe.name : '???'} = ${recipe.elements.map(e => `<span class="element-${e}">${e}</span>`).join(' + ')}
          ${!hasElements ? ' (missing runes)' : ''}
        </div>
      `;
    }
    hintHtml += '</div>';

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="game-icons:anvil" width="48" style="color:var(--fire)"></iconify-icon>
              <h2>Runforge</h2>
            </div>
            <p style="color:var(--text-dim);margin-bottom:12px">Select two runes to combine into a new spell. Crafted spells are key to surviving the dungeon's challenges.</p>

            <h3>Your Runes</h3>
            <div class="rune-grid">${runesHtml}</div>
            ${this.forgeSelection.length === 2 ? '<p style="font-size:0.85rem;color:var(--accent);margin-bottom:8px">Combining: ' + this.forgeSelection.join(' + ') + '</p>' : '<p style="font-size:0.85rem;color:var(--text-dim)">Select 2 runes to combine</p>'}
            ${recipeHtml}
            ${knownHtml}
            ${hintHtml}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Leave Forge
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderInventory() {
    const s = this.state;

    // Equipment slots
    let equipHtml = '<div style="margin-bottom:16px"><h3>Equipment</h3><div class="char-stats">';
    for (const [slot, item] of Object.entries(s.player.equipment)) {
      if (item) {
        equipHtml += `
          <div class="char-stat">
            <iconify-icon icon="${item.icon}" style="color:var(--gold)"></iconify-icon>
            <span>${item.name}</span>
            <span style="font-size:0.75rem;color:var(--text-dim)">(${slot})</span>
            <button class="btn btn-small" data-action="unequip-item" data-slot="${slot}" style="margin-left:auto;padding:2px 6px">X</button>
          </div>
        `;
      } else {
        equipHtml += `<div class="char-stat" style="color:var(--text-dim)"><span>${slot}</span><span style="margin-left:auto">empty</span></div>`;
      }
    }
    equipHtml += '</div></div>';

    // Inventory items
    let invHtml = '<h3>Items</h3>';
    if (s.player.inventory.length === 0) {
      invHtml += '<p style="color:var(--text-dim)">No items</p>';
    } else {
      invHtml += '<div class="inventory-grid">';
      for (const item of s.player.inventory) {
        let actionAttr = '';
        if (item.type === 'equipment') {
          actionAttr = `data-action="equip-item" data-item-id="${item.id}"`;
        } else if (item.type === 'consumable') {
          actionAttr = `data-action="use-item" data-item-id="${item.id}"`;
        }
        invHtml += `
          <div class="inv-item" ${actionAttr}>
            <iconify-icon icon="${item.icon}" style="color:var(--gold)"></iconify-icon>
            <div class="inv-item-name">${item.name}</div>
            <div style="font-size:0.7rem;color:var(--text-dim)">${item.type}</div>
          </div>
        `;
      }
      invHtml += '</div>';
    }

    // Runes
    let runeHtml = '<div style="margin-top:16px"><h3>Runes</h3><div class="rune-grid">';
    for (const rune of s.player.runes) {
      runeHtml += `
        <div class="rune-chip element-${rune.element}">
          <iconify-icon icon="${rune.icon}"></iconify-icon> ${rune.name}
        </div>
      `;
    }
    runeHtml += '</div></div>';

    // Spells
    let spellHtml = '<div style="margin-top:16px"><h3>Spells</h3>';
    for (const spell of s.player.spells) {
      spellHtml += `
        <div class="shop-item">
          <iconify-icon icon="${spell.icon}" style="font-size:1.3rem;color:${spell.isCrafted ? 'var(--gold)' : 'var(--arcane)'}"></iconify-icon>
          <div class="shop-item-info">
            <div class="shop-item-name">${spell.name} ${spell.isCrafted ? '<span style="font-size:0.75rem;color:var(--gold)">[Crafted]</span>' : ''}</div>
            <div class="shop-item-desc">${spell.description} | Cost: ${spell.manaCost} MP | Uses: ${spell.affinityUses || 0}</div>
          </div>
        </div>
      `;
    }
    spellHtml += '</div>';

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:knapsack"></iconify-icon> Inventory</h2>
            ${equipHtml}
            ${invHtml}
            ${runeHtml}
            ${spellHtml}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Back
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderCharacter() {
    const s = this.state;
    const stats = getEffectiveStats(s);

    let statsHtml = `
      <div class="char-stats">
        <div class="char-stat"><iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon> Max HP <span class="char-stat-value">${stats.maxHp}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:crystal-ball" style="color:var(--mana)"></iconify-icon> Max Mana <span class="char-stat-value">${stats.maxMana}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:broadsword" style="color:var(--danger)"></iconify-icon> Attack <span class="char-stat-value">${stats.attack}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:shield" style="color:var(--accent)"></iconify-icon> Defense <span class="char-stat-value">${stats.defense}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:magic-lamp" style="color:var(--shadow)"></iconify-icon> Spell Power <span class="char-stat-value">${stats.spellPower}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:level-end-flag" style="color:var(--gold)"></iconify-icon> Level <span class="char-stat-value">${s.player.level}</span></div>
      </div>
    `;

    // Skill tree
    let skillTreeHtml = `<div style="margin-top:20px"><h3><iconify-icon icon="game-icons:upgrade"></iconify-icon> Skill Tree (${s.player.skillPoints} points available)</h3>`;
    for (const node of s.skillTreeData) {
      const unlocked = s.player.unlockedSkills.includes(node.id);
      const canUnlock = !unlocked && s.player.skillPoints >= node.cost && node.requires.every(r => s.player.unlockedSkills.includes(r));
      const locked = !unlocked && !canUnlock;
      skillTreeHtml += `
        <div class="skill-node ${unlocked ? 'unlocked' : locked ? 'locked' : ''}" ${canUnlock ? `data-action="unlock-skill" data-skill-id="${node.id}"` : ''}>
          <iconify-icon icon="${node.icon}" style="color:${unlocked ? 'var(--gold)' : 'var(--text-dim)'}"></iconify-icon>
          <div class="skill-node-info">
            <div><strong>${node.name}</strong></div>
            <div style="font-size:0.8rem;color:var(--text-dim)">${node.description}</div>
            ${node.requires.length > 0 ? `<div style="font-size:0.75rem;color:var(--text-dim)">Requires: ${node.requires.join(', ')}</div>` : ''}
          </div>
          <div class="skill-cost">${unlocked ? 'Unlocked' : `${node.cost} pts`}</div>
        </div>
      `;
    }
    skillTreeHtml += '</div>';

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:character"></iconify-icon> Character Sheet</h2>
            ${statsHtml}
            ${skillTreeHtml}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Back
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderMap() {
    const s = this.state;
    const floor = getCurrentFloor(s);
    if (!floor) return;

    let nodesHtml = '';
    for (const room of floor.rooms) {
      const isCurrent = room.id === s.currentRoomId;
      const isVisited = s.visitedRooms.includes(room.id);
      const isCleared = s.clearedRooms.includes(room.id);
      let cls = '';
      if (isCurrent) cls = 'current';
      else if (isCleared) cls = 'cleared';
      else if (isVisited) cls = 'visited';

      nodesHtml += `
        <div class="map-node ${cls}" data-action="map-navigate" data-room="${room.id}" ${!isVisited ? 'style="opacity:0.3;cursor:default"' : ''}>
          <iconify-icon icon="${isVisited ? room.icon : 'game-icons:uncertainty'}" style="color:${isCurrent ? 'var(--accent-bright)' : isCleared ? 'var(--nature)' : 'var(--text-dim)'}"></iconify-icon>
          <div class="map-node-name">${isVisited ? room.name : '???'}</div>
          <span class="room-type-badge type-${isVisited ? room.type : 'corridor'}" style="font-size:0.6rem">${isVisited ? room.type : '?'}</span>
        </div>
      `;
    }

    this.root.innerHTML = `
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:treasure-map"></iconify-icon> ${floor.name} - Map</h2>
            <p style="color:var(--text-dim);font-size:0.85rem;margin-bottom:12px">Click a visited room to navigate there.</p>
            <div class="map-container">${nodesHtml}</div>
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Back
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;
    this.bind();
  }

  private renderVictory() {
    const s = this.state;
    const craftedUsed = Object.keys(s.player.craftedSpellUsedOnFloor).length;
    const totalAffinities = Object.entries(s.player.affinities);

    this.root.innerHTML = `
      <div class="end-screen victory">
        <iconify-icon icon="game-icons:crown" style="font-size:80px;color:var(--gold);filter:drop-shadow(0 0 30px var(--gold-dim))"></iconify-icon>
        <h1>Dungeon Escaped!</h1>
        <p style="color:var(--text-dim);font-size:1.1rem">You conquered the dungeon and escaped alive.</p>
        <div class="panel" style="text-align:left;max-width:400px;width:100%">
          <h3>Run Statistics</h3>
          <div class="end-stats">
            <div class="char-stat"><iconify-icon icon="game-icons:level-end-flag"></iconify-icon> Level <span class="char-stat-value">${s.player.level}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:coins"></iconify-icon> Gold <span class="char-stat-value">${s.player.gold}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:sword-clash"></iconify-icon> Turns <span class="char-stat-value">${s.turnsElapsed}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:anvil"></iconify-icon> Crafted Spells Used <span class="char-stat-value">${craftedUsed} floors</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:spell-book"></iconify-icon> Recipes Found <span class="char-stat-value">${s.player.discoveredRecipes.length}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:meal"></iconify-icon> Hunger <span class="char-stat-value">${Math.floor(s.player.hungerLevel)}</span></div>
          </div>
          <div style="margin-top:12px">
            <h3>Affinities</h3>
            ${totalAffinities.map(([e, c]) => `<div class="affinity-row"><span class="element-${e}">${e}</span><span>${c} casts</span></div>`).join('')}
          </div>
          <div style="margin-top:12px">
            <h3>Traits</h3>
            ${Object.entries(s.player.traits).map(([t, v]) => `<div class="trait-row"><span>${t}</span><span class="trait-value">${v.toFixed(2)}</span></div>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary" data-action="new-game-from-defeat">
          <iconify-icon icon="game-icons:sword-brandish"></iconify-icon> New Game
        </button>
      </div>
    `;
    this.bind();
  }

  private renderDefeat() {
    this.root.innerHTML = `
      <div class="end-screen defeat">
        <iconify-icon icon="game-icons:skull" style="font-size:80px;color:var(--danger);filter:drop-shadow(0 0 30px var(--blood-dim))"></iconify-icon>
        <h1>Defeated</h1>
        <p style="color:var(--text-dim);font-size:1.1rem">The dungeon claims another soul...</p>
        <p style="color:var(--text-dim)">Level: ${this.state.player.level} | Rooms cleared: ${this.state.clearedRooms.length} | Turns: ${this.state.turnsElapsed}</p>
        <button class="btn btn-primary" data-action="new-game-from-defeat">
          <iconify-icon icon="game-icons:sword-brandish"></iconify-icon> Try Again
        </button>
      </div>
    `;
    this.bind();
  }
}
