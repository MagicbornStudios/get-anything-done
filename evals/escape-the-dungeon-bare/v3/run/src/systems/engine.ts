import type { GameState, Player, Enemy, Room, GameScene, InventoryItem, Spell, Rune } from "../types";
import { DataLoader } from "./data-loader";
import { UIRenderer } from "./ui";
import { saveGame, loadGame, hasSave, deleteSave } from "./save-system";
import { createEntitySVG, getRoomIcon, getRoomColor, getRoomBg, getSpellIcon } from "./sprites";

export class GameEngine {
  private data: DataLoader;
  private ui: UIRenderer;
  private state!: GameState;

  constructor() {
    this.data = new DataLoader();
    this.ui = new UIRenderer();
  }

  start(): void {
    this.data.load();
    this.showTitle();
  }

  // ============================================================
  // TITLE SCREEN
  // ============================================================
  private showTitle(): void {
    const hasSaveGame = hasSave();
    this.ui.render(`
      <div class="title-screen">
        <h1>Escape the Dungeon</h1>
        <p class="subtitle">A roguelike dungeon crawler</p>
        <div>
          <button class="btn btn-primary" data-action="new-game">New Game</button>
          ${hasSaveGame ? '<button class="btn" data-action="continue">Continue</button>' : ""}
        </div>
        ${hasSaveGame ? '<div style="margin-top:12px"><button class="btn btn-small btn-danger" data-action="delete-save">Delete Save</button></div>' : ""}
      </div>
    `);

    this.ui.bindClick('[data-action="new-game"]', () => this.newGame());
    if (hasSaveGame) {
      this.ui.bindClick('[data-action="continue"]', () => this.continueGame());
      this.ui.bindClick('[data-action="delete-save"]', () => {
        deleteSave();
        this.showTitle();
      });
    }
  }

  private newGame(): void {
    const player: Player = {
      name: "Adventurer",
      level: 1,
      xp: 0,
      xpToNext: 30,
      combatStats: {
        currentHp: 60,
        maxHp: 60,
        currentMana: 25,
        maxMana: 25,
        might: 8,
        agility: 6,
        defense: 5,
        power: 5,
        insight: 4,
        willpower: 4,
      },
      inventory: [],
      spells: [],
      runes: [],
      crystals: 0,
      currentRoomId: "f1_start",
      currentFloor: 1,
      discoveredRooms: ["f1_start"],
      tick: 0,
    };

    // Give starting items
    const hpPot = this.data.getItem("health_potion");
    if (hpPot) { hpPot.quantity = 2; player.inventory.push(hpPot); }
    const manaPot = this.data.getItem("mana_potion");
    if (manaPot) { manaPot.quantity = 1; player.inventory.push(manaPot); }

    // Give starting runes
    const startRunes = ["aqua", "terra", "ventus"];
    for (const rId of startRunes) {
      const r = this.data.getRune(rId);
      if (r) player.runes.push(r);
    }

    this.state = {
      scene: "room",
      player,
      combatLog: [],
      menuOpen: null,
    };

    saveGame(this.state.player);
    this.showRoom();
  }

  private continueGame(): void {
    const saved = loadGame();
    if (!saved) { this.newGame(); return; }
    this.state = {
      scene: "room",
      player: saved,
      combatLog: [],
      menuOpen: null,
    };
    this.showRoom();
  }

  // ============================================================
  // HUD
  // ============================================================
  private renderHUD(): string {
    const p = this.state.player;
    return `
      <div class="hud">
        <div class="hud-name">${p.name} Lv.${p.level}</div>
        <div class="hud-bars">
          <div class="hud-bar-group">
            <div class="hud-bar-label">HP</div>
            ${UIRenderer.hpBar(p.combatStats.currentHp, p.combatStats.maxHp, "#e44")}
          </div>
          <div class="hud-bar-group">
            <div class="hud-bar-label">Mana</div>
            ${UIRenderer.manaBar(p.combatStats.currentMana, p.combatStats.maxMana)}
          </div>
          <div class="hud-bar-group">
            <div class="hud-bar-label">XP</div>
            ${UIRenderer.xpBar(p.xp, p.xpToNext)}
          </div>
        </div>
        <div class="hud-info">
          <span>Floor: <span class="floor-num">${p.currentFloor}</span></span>
          <span>Tick: ${p.tick}</span>
          <span>💎 ${p.crystals}</span>
        </div>
        <div class="hud-menus">
          <button class="btn btn-small" data-menu="map">🗺️ Map</button>
          <button class="btn btn-small" data-menu="bag">🎒 Bag</button>
          <button class="btn btn-small" data-menu="spellbook">📖 Spells</button>
          <button class="btn btn-small" data-menu="stats">📊 Stats</button>
        </div>
      </div>
    `;
  }

  private bindHUDMenus(): void {
    const menus = ["map", "bag", "spellbook", "stats"] as const;
    for (const m of menus) {
      this.ui.bindClick(`[data-menu="${m}"]`, () => this.toggleMenu(m));
    }
  }

  // ============================================================
  // OVERLAY MENUS
  // ============================================================
  private toggleMenu(menu: "map" | "bag" | "spellbook" | "stats"): void {
    if (this.state.menuOpen === menu) {
      this.state.menuOpen = null;
      // Re-render current scene
      this.rerenderScene();
      return;
    }
    this.state.menuOpen = menu;
    this.rerenderScene();
  }

  private rerenderScene(): void {
    switch (this.state.scene) {
      case "room": this.showRoom(); break;
      case "combat": this.showCombat(); break;
      case "dialogue": this.showDialogue(); break;
      case "forge": this.showForge(); break;
    }
  }

  private renderMenuOverlay(): string {
    if (!this.state.menuOpen) return "";
    const p = this.state.player;

    switch (this.state.menuOpen) {
      case "bag":
        return `
          <div class="overlay-menu">
            <div class="overlay-header">
              <span class="overlay-title">🎒 Inventory</span>
              <button class="btn btn-small" data-close-menu>Close</button>
            </div>
            ${p.inventory.length === 0 ? "<p style='color:#888'>Your bag is empty.</p>" :
              p.inventory.map((item, i) => `
                <div class="item-row">
                  <span class="item-icon">${this.getItemIcon(item.type)}</span>
                  <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-desc">${item.description}</div>
                  </div>
                  <span class="item-qty">x${item.quantity}</span>
                  ${this.state.scene !== "combat" ? `<button class="btn btn-small" data-use-item="${i}">Use</button>` : ""}
                </div>
              `).join("")
            }
            <div style="margin-top:12px;color:#888;font-size:0.85rem">💎 Crystals: ${p.crystals}</div>
          </div>
        `;

      case "spellbook":
        return `
          <div class="overlay-menu">
            <div class="overlay-header">
              <span class="overlay-title">📖 Spellbook</span>
              <button class="btn btn-small" data-close-menu>Close</button>
            </div>
            ${p.spells.length === 0 ? "<p style='color:#888'>No spells learned. Visit the Rune Forge!</p>" :
              p.spells.map(spell => `
                <div class="spell-row">
                  <span class="spell-icon">${getSpellIcon(spell.element)}</span>
                  <div class="spell-info">
                    <div class="spell-name">${spell.name}</div>
                    <div class="spell-desc">${spell.description}</div>
                  </div>
                  <span class="spell-cost">${spell.manaCost} MP</span>
                </div>
              `).join("")
            }
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #333">
              <div style="color:#888;font-size:0.85rem;margin-bottom:8px">Runes:</div>
              ${p.runes.length === 0 ? "<span style='color:#555'>None</span>" :
                p.runes.map(r => `<span style="margin-right:8px" title="${r.name}: ${r.description}">${r.symbol} ${r.name}</span>`).join("")
              }
            </div>
          </div>
        `;

      case "stats":
        return `
          <div class="overlay-menu">
            <div class="overlay-header">
              <span class="overlay-title">📊 Stats</span>
              <button class="btn btn-small" data-close-menu>Close</button>
            </div>
            <div class="stat-row"><span class="stat-label">Level</span><span class="stat-value">${p.level}</span></div>
            <div class="stat-row"><span class="stat-label">XP</span><span class="stat-value">${p.xp} / ${p.xpToNext}</span></div>
            <div class="stat-row"><span class="stat-label">Might</span><span class="stat-value">${p.combatStats.might}</span></div>
            <div class="stat-row"><span class="stat-label">Agility</span><span class="stat-value">${p.combatStats.agility}</span></div>
            <div class="stat-row"><span class="stat-label">Defense</span><span class="stat-value">${p.combatStats.defense}</span></div>
            <div class="stat-row"><span class="stat-label">Power</span><span class="stat-value">${p.combatStats.power}</span></div>
            <div class="stat-row"><span class="stat-label">Insight</span><span class="stat-value">${p.combatStats.insight}</span></div>
            <div class="stat-row"><span class="stat-label">Willpower</span><span class="stat-value">${p.combatStats.willpower}</span></div>
            <div class="stat-row"><span class="stat-label">Crystals</span><span class="stat-value">💎 ${p.crystals}</span></div>
          </div>
        `;

      case "map":
        return this.renderMapOverlay();

      default:
        return "";
    }
  }

  private renderMapOverlay(): string {
    const p = this.state.player;
    const rooms = this.data.getRoomsForFloor(p.currentFloor);
    return `
      <div class="overlay-menu">
        <div class="overlay-header">
          <span class="overlay-title">🗺️ Floor ${p.currentFloor} Map</span>
          <button class="btn btn-small" data-close-menu>Close</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center">
          ${rooms.map(room => {
            const discovered = p.discoveredRooms.includes(room.id);
            const current = room.id === p.currentRoomId;
            const cls = current ? "current" : discovered ? "visited" : "undiscovered";
            return `
              <div class="map-room ${cls}" style="border-color:${discovered ? getRoomColor(room.type) : '#333'}">
                ${discovered ? `${getRoomIcon(room.type)} ${room.name}` : "???"}
                ${current ? " 📍" : ""}
              </div>
            `;
          }).join("")}
        </div>
        <div style="margin-top:12px;font-size:0.75rem;color:#666;text-align:center">
          Discovered: ${p.discoveredRooms.length} / ${rooms.length} rooms
        </div>
      </div>
    `;
  }

  private bindMenuClose(): void {
    this.ui.bindClick("[data-close-menu]", () => {
      this.state.menuOpen = null;
      this.rerenderScene();
    });
    // Bind use item buttons in bag
    if (this.state.menuOpen === "bag") {
      this.ui.bindAllClicks("[data-use-item]", (i) => this.useItem(i));
    }
  }

  private getItemIcon(type: string): string {
    const icons: Record<string, string> = {
      potion: "🧪",
      scroll: "📜",
      equipment: "🛡️",
      key: "🔑",
    };
    return icons[type] || "📦";
  }

  // ============================================================
  // ROOM NAVIGATION
  // ============================================================
  private showRoom(): void {
    this.state.scene = "room";
    const p = this.state.player;
    const room = this.data.getRoom(p.currentRoomId);
    if (!room) { console.error("Room not found:", p.currentRoomId); return; }

    // Discover adjacent rooms
    for (const exit of room.exits) {
      if (!p.discoveredRooms.includes(exit.targetRoomId)) {
        p.discoveredRooms.push(exit.targetRoomId);
      }
    }

    const roomColor = getRoomColor(room.type);
    const roomBg = getRoomBg(room.type);

    this.ui.render(`
      <div class="game-container" style="background:${roomBg}">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="room-panel" style="animation:fadeIn 0.3s ease">
            <div class="room-header">
              <span class="room-icon">${getRoomIcon(room.type)}</span>
              <span class="room-name">${room.name}</span>
            </div>
            <div class="room-type-badge" style="background:${roomColor};color:#fff">${room.type}</div>
            <p class="room-description">${room.description}</p>

            ${this.renderRoomContent(room)}

            <div class="room-exits" style="margin-top:16px">
              ${room.exits.map((exit, i) => {
                const targetRoom = this.data.getRoom(exit.targetRoomId);
                const discovered = p.discoveredRooms.includes(exit.targetRoomId);
                const targetType = targetRoom && discovered ? targetRoom.type : "unknown";
                const targetName = targetRoom && discovered ? targetRoom.name : "???";
                const icon = discovered ? getRoomIcon(targetType) : "❓";
                return `
                  <button class="btn exit-btn" data-exit="${i}">
                    ${icon} ${exit.direction} — ${targetName}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `);

    // Bind exit clicks
    room.exits.forEach((_, i) => {
      this.ui.bindClick(`[data-exit="${i}"]`, () => this.navigateTo(room.exits[i].targetRoomId));
    });

    this.bindHUDMenus();
    this.bindMenuClose();
    this.bindRoomActions();
  }

  private renderRoomContent(room: Room): string {
    switch (room.type) {
      case "rest":
        return `
          <div style="margin:16px 0">
            <p style="color:#6c6;margin-bottom:12px">The soothing waters offer rest and recovery.</p>
            <button class="btn" data-action="rest">💤 Rest (Restore HP & Mana)</button>
          </div>
        `;
      case "treasure":
        if (room.loot && room.loot.length > 0 && !room.visited) {
          return `
            <div style="margin:16px 0">
              <p style="color:#cc0;margin-bottom:12px">A treasure chest awaits!</p>
              <button class="btn btn-primary" data-action="open-chest">💎 Open Chest</button>
            </div>
          `;
        }
        return `<p style="color:#666;margin:16px 0">The chest has already been opened.</p>`;
      case "combat":
        if (!room.visited && room.enemyId) {
          return `
            <div style="margin:16px 0">
              <p style="color:#c44;margin-bottom:12px">An enemy lurks here!</p>
              <button class="btn btn-danger" data-action="engage">⚔️ Engage Enemy</button>
            </div>
          `;
        }
        return `<p style="color:#666;margin:16px 0">The room is clear.</p>`;
      case "boss":
        if (!room.visited && room.enemyId) {
          return `
            <div style="margin:16px 0">
              <p style="color:#c06;margin-bottom:12px;font-weight:bold">The Dungeon Keeper blocks your path!</p>
              <button class="btn btn-danger" data-action="engage">💀 Challenge the Boss</button>
            </div>
          `;
        }
        return `<p style="color:#6c6;margin:16px 0">The boss has been defeated. The path forward is clear.</p>`;
      case "dialogue":
        if (room.npcId) {
          return `
            <div style="margin:16px 0">
              <button class="btn" data-action="talk">💬 Talk to NPC</button>
            </div>
          `;
        }
        return "";
      case "forge":
        return `
          <div style="margin:16px 0">
            <p style="color:#f80;margin-bottom:12px">The ancient forge thrums with arcane power.</p>
            <button class="btn btn-primary" data-action="forge">🔨 Use Rune Forge</button>
          </div>
        `;
      default:
        return "";
    }
  }

  private navigateTo(roomId: string): void {
    this.state.menuOpen = null;
    this.state.player.currentRoomId = roomId;
    this.state.player.tick++;

    // Discover new room
    if (!this.state.player.discoveredRooms.includes(roomId)) {
      this.state.player.discoveredRooms.push(roomId);
    }

    saveGame(this.state.player);
    this.showRoom();
  }

  private bindRoomActions(): void {
    const room = this.data.getRoom(this.state.player.currentRoomId);
    if (!room) return;

    this.ui.bindClick('[data-action="rest"]', () => this.doRest());
    this.ui.bindClick('[data-action="open-chest"]', () => this.openChest(room));
    this.ui.bindClick('[data-action="engage"]', () => this.startCombat(room));
    this.ui.bindClick('[data-action="talk"]', () => this.startDialogue(room));
    this.ui.bindClick('[data-action="forge"]', () => this.showForge());
  }

  private doRest(): void {
    const p = this.state.player;
    p.combatStats.currentHp = p.combatStats.maxHp;
    p.combatStats.currentMana = p.combatStats.maxMana;
    saveGame(p);
    this.showRoom();
  }

  private openChest(room: Room): void {
    if (!room.loot) return;
    const p = this.state.player;
    for (const itemId of room.loot) {
      const item = this.data.getItem(itemId);
      if (item) {
        const existing = p.inventory.find(i => i.id === item.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          p.inventory.push(item);
        }
      }
    }
    p.crystals += 10;
    room.visited = true;
    // Mark visited in data loader too
    const realRoom = this.data.getRoom(room.id);
    if (realRoom) realRoom.visited = true;
    saveGame(p);
    this.showRoom();
    this.bindRoomActions();
  }

  // ============================================================
  // COMBAT
  // ============================================================
  private startCombat(room: Room): void {
    if (!room.enemyId) return;
    const enemy = this.data.getEnemy(room.enemyId);
    if (!enemy) return;

    this.state.scene = "combat";
    this.state.currentEnemy = enemy;
    this.state.combatLog = [`A ${enemy.name} appears!`];
    this.state.menuOpen = null;

    this.showCombat();
  }

  private showCombat(): void {
    const p = this.state.player;
    const enemy = this.state.currentEnemy;
    if (!enemy) { this.showRoom(); return; }

    const canCastSpell = p.spells.length > 0;
    const canUseBag = p.inventory.length > 0;

    this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #1a0808 0%, #0a0a0f 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="combat-panel" style="animation:fadeIn 0.3s ease">
            <div class="combat-header">⚔️ COMBAT ⚔️</div>
            <div class="combat-arena">
              <div class="combatant">
                <div class="combatant-name" style="color:#4af">${p.name}</div>
                <div class="combatant-sprite">${createEntitySVG("hermit", "#4488ff", 64)}</div>
                <div class="combatant-bars">
                  <div style="font-size:0.7rem;color:#888;margin-bottom:2px">HP</div>
                  ${UIRenderer.hpBar(p.combatStats.currentHp, p.combatStats.maxHp, "#4a4")}
                  <div style="font-size:0.7rem;color:#888;margin:4px 0 2px">MP</div>
                  ${UIRenderer.manaBar(p.combatStats.currentMana, p.combatStats.maxMana)}
                </div>
              </div>
              <div class="combat-vs">VS</div>
              <div class="combatant">
                <div class="combatant-name" style="color:${enemy.color}">${enemy.name}</div>
                <div class="combatant-sprite">${createEntitySVG(enemy.sprite, enemy.color, 64)}</div>
                <div class="combatant-bars">
                  <div style="font-size:0.7rem;color:#888;margin-bottom:2px">HP</div>
                  ${UIRenderer.hpBar(enemy.combatStats.currentHp, enemy.combatStats.maxHp, "#e44")}
                </div>
              </div>
            </div>

            <div class="combat-actions">
              <button class="btn" data-combat="fight">⚔️ Fight</button>
              <button class="btn" data-combat="spells" ${!canCastSpell ? "disabled" : ""}>✨ Spells</button>
              <button class="btn" data-combat="bag" ${!canUseBag ? "disabled" : ""}>🎒 Bag</button>
              <button class="btn btn-danger" data-combat="run">🏃 Run</button>
            </div>

            ${this.combatSpellSelect ? this.renderSpellSelect() : ""}
            ${this.combatBagOpen ? this.renderCombatBag() : ""}

            <div class="combat-log">
              ${this.state.combatLog.slice(-6).map(log => {
                const cls = log.includes("damage") || log.includes("hits") ? "log-damage" :
                           log.includes("heal") || log.includes("restore") ? "log-heal" : "log-info";
                return `<div class="log-entry ${cls}">${log}</div>`;
              }).join("")}
            </div>
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `);

    this.ui.bindClick('[data-combat="fight"]', () => this.combatFight());
    this.ui.bindClick('[data-combat="spells"]', () => {
      this.combatSpellSelect = !this.combatSpellSelect;
      this.combatBagOpen = false;
      this.showCombat();
    });
    this.ui.bindClick('[data-combat="bag"]', () => {
      this.combatBagOpen = !this.combatBagOpen;
      this.combatSpellSelect = false;
      this.showCombat();
    });
    this.ui.bindClick('[data-combat="run"]', () => this.combatRun());

    if (this.combatSpellSelect) {
      this.state.player.spells.forEach((_, i) => {
        this.ui.bindClick(`[data-cast-spell="${i}"]`, () => this.combatCastSpell(i));
      });
    }
    if (this.combatBagOpen) {
      this.state.player.inventory.forEach((_, i) => {
        this.ui.bindClick(`[data-combat-use-item="${i}"]`, () => this.combatUseItem(i));
      });
    }

    this.bindHUDMenus();
    this.bindMenuClose();
  }

  private combatSpellSelect = false;
  private combatBagOpen = false;

  private renderSpellSelect(): string {
    const p = this.state.player;
    return `
      <div style="margin-bottom:12px;padding:12px;background:rgba(0,0,0,0.3);border:1px solid #444;border-radius:8px">
        <div style="font-size:0.85rem;color:#888;margin-bottom:8px">Select a spell:</div>
        ${p.spells.map((spell, i) => {
          const canCast = p.combatStats.currentMana >= spell.manaCost;
          return `
            <button class="btn btn-small" data-cast-spell="${i}" ${!canCast ? "disabled" : ""}
              style="margin:3px;text-align:left;display:block;width:100%">
              ${getSpellIcon(spell.element)} ${spell.name} (${spell.manaCost} MP) — ${spell.damage > 0 ? spell.damage + " dmg" : spell.description}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderCombatBag(): string {
    const p = this.state.player;
    return `
      <div style="margin-bottom:12px;padding:12px;background:rgba(0,0,0,0.3);border:1px solid #444;border-radius:8px">
        <div style="font-size:0.85rem;color:#888;margin-bottom:8px">Use an item:</div>
        ${p.inventory.map((item, i) => `
          <button class="btn btn-small" data-combat-use-item="${i}"
            style="margin:3px;text-align:left;display:block;width:100%">
            ${this.getItemIcon(item.type)} ${item.name} x${item.quantity} — ${item.description}
          </button>
        `).join("")}
      </div>
    `;
  }

  private combatFight(): void {
    const p = this.state.player;
    const enemy = this.state.currentEnemy;
    if (!enemy) return;

    // Player attacks
    const playerDmg = Math.max(1, p.combatStats.might - Math.floor(enemy.combatStats.defense / 2) + Math.floor(Math.random() * 4));
    enemy.combatStats.currentHp -= playerDmg;
    this.state.combatLog.push(`You hit ${enemy.name} for ${playerDmg} damage!`);

    if (enemy.combatStats.currentHp <= 0) {
      this.combatVictory();
      return;
    }

    // Enemy attacks
    this.enemyTurn();
  }

  private combatCastSpell(index: number): void {
    const p = this.state.player;
    const enemy = this.state.currentEnemy;
    if (!enemy) return;

    const spell = p.spells[index];
    if (!spell || p.combatStats.currentMana < spell.manaCost) return;

    p.combatStats.currentMana -= spell.manaCost;
    this.combatSpellSelect = false;

    if (spell.effect === "heal") {
      const healAmt = spell.effectValue || 25;
      p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + healAmt);
      this.state.combatLog.push(`You cast ${spell.name} and restore ${healAmt} HP!`);
    } else if (spell.effect === "buff") {
      const buffAmt = spell.effectValue || 5;
      p.combatStats.defense += buffAmt;
      this.state.combatLog.push(`You cast ${spell.name}! Defense +${buffAmt}!`);
    } else if (spell.effect === "debuff") {
      const debuffAmt = spell.effectValue || 3;
      enemy.combatStats.defense = Math.max(0, enemy.combatStats.defense - debuffAmt);
      const spellDmg = spell.damage + Math.floor(p.combatStats.power / 2);
      enemy.combatStats.currentHp -= spellDmg;
      this.state.combatLog.push(`You cast ${spell.name} for ${spellDmg} damage! Enemy defense -${debuffAmt}!`);
    } else {
      const spellDmg = spell.damage + Math.floor(p.combatStats.power / 2);
      enemy.combatStats.currentHp -= spellDmg;
      this.state.combatLog.push(`You cast ${spell.name} for ${spellDmg} damage!`);
    }

    if (enemy.combatStats.currentHp <= 0) {
      this.combatVictory();
      return;
    }

    this.enemyTurn();
  }

  private combatUseItem(index: number): void {
    const p = this.state.player;
    const item = p.inventory[index];
    if (!item) return;

    this.combatBagOpen = false;

    if (item.effect) {
      const stat = item.effect.stat;
      if (stat === "currentHp") {
        p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + item.effect.value);
        this.state.combatLog.push(`You use ${item.name} and restore ${item.effect.value} HP!`);
      } else if (stat === "currentMana") {
        p.combatStats.currentMana = Math.min(p.combatStats.maxMana, p.combatStats.currentMana + item.effect.value);
        this.state.combatLog.push(`You use ${item.name} and restore ${item.effect.value} Mana!`);
      } else {
        (p.combatStats as unknown as Record<string, number>)[stat] += item.effect.value;
        this.state.combatLog.push(`You use ${item.name}! ${stat} +${item.effect.value}!`);
      }
    }

    item.quantity--;
    if (item.quantity <= 0) {
      p.inventory.splice(index, 1);
    }

    // Enemy still gets a turn after using item
    this.enemyTurn();
  }

  private combatRun(): void {
    const p = this.state.player;
    const fleeChance = 0.4 + (p.combatStats.agility / 30);
    if (Math.random() < fleeChance) {
      this.state.combatLog.push("You successfully fled!");
      this.combatSpellSelect = false;
      this.combatBagOpen = false;
      this.state.currentEnemy = undefined;
      this.state.scene = "room";
      this.showRoom();
      this.bindRoomActions();
    } else {
      this.state.combatLog.push("You failed to flee!");
      this.enemyTurn();
    }
  }

  private enemyTurn(): void {
    const p = this.state.player;
    const enemy = this.state.currentEnemy;
    if (!enemy) return;

    const enemyDmg = Math.max(1, enemy.combatStats.might - Math.floor(p.combatStats.defense / 2) + Math.floor(Math.random() * 3));
    p.combatStats.currentHp -= enemyDmg;
    this.state.combatLog.push(`${enemy.name} hits you for ${enemyDmg} damage!`);

    if (p.combatStats.currentHp <= 0) {
      p.combatStats.currentHp = 0;
      this.combatDefeat();
      return;
    }

    saveGame(p);
    this.showCombat();
  }

  private combatVictory(): void {
    const enemy = this.state.currentEnemy!;
    const p = this.state.player;
    enemy.combatStats.currentHp = 0;

    const xpGain = enemy.xpReward;
    const crystalGain = enemy.crystalReward;
    p.xp += xpGain;
    p.crystals += crystalGain;

    // Mark room visited
    const room = this.data.getRoom(p.currentRoomId);
    if (room) room.visited = true;

    // Check level up
    let leveledUp = false;
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level++;
      p.xpToNext = Math.floor(p.xpToNext * 1.5);
      p.combatStats.maxHp += 8;
      p.combatStats.currentHp = p.combatStats.maxHp;
      p.combatStats.maxMana += 4;
      p.combatStats.currentMana = p.combatStats.maxMana;
      p.combatStats.might += 2;
      p.combatStats.defense += 1;
      p.combatStats.power += 1;
      p.combatStats.agility += 1;
      leveledUp = true;
    }

    this.combatSpellSelect = false;
    this.combatBagOpen = false;

    this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #081808 0%, #0a0a0f 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="result-panel" style="animation:fadeIn 0.5s ease">
            <h2 style="color:#4c4">Victory!</h2>
            <div class="combatant-sprite" style="opacity:0.3">${createEntitySVG(enemy.sprite, enemy.color, 80)}</div>
            <p style="margin:12px 0;color:#aaa">You defeated the ${enemy.name}!</p>
            <div class="rewards">
              <p>🌟 +${xpGain} XP</p>
              <p>💎 +${crystalGain} Crystals</p>
            </div>
            ${leveledUp ? `<div class="level-up">🎉 Level Up! You are now Level ${p.level}!</div>` : ""}
            <button class="btn btn-primary" data-action="continue">Continue</button>
          </div>
        </div>
      </div>
    `);

    saveGame(p);

    this.ui.bindClick('[data-action="continue"]', () => {
      this.state.currentEnemy = undefined;
      this.state.scene = "room";
      this.showRoom();
      this.bindRoomActions();
    });
    this.bindHUDMenus();
  }

  private combatDefeat(): void {
    this.combatSpellSelect = false;
    this.combatBagOpen = false;

    this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #1a0808 0%, #0a0a0f 100%)">
        <div class="main-area">
          <div class="result-panel" style="animation:fadeIn 0.5s ease">
            <h2 style="color:#c44">Defeat!</h2>
            <p style="color:#888;margin:16px 0">You have fallen in the dungeon...</p>
            <div style="display:flex;gap:12px;justify-content:center">
              <button class="btn btn-primary" data-action="retry">🔄 Try Again</button>
              <button class="btn" data-action="title">🏠 Title Screen</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.ui.bindClick('[data-action="retry"]', () => {
      // Revive with half HP at start room
      const p = this.state.player;
      p.combatStats.currentHp = Math.floor(p.combatStats.maxHp / 2);
      p.combatStats.currentMana = Math.floor(p.combatStats.maxMana / 2);
      p.currentRoomId = "f1_start";
      this.state.currentEnemy = undefined;
      this.state.scene = "room";
      saveGame(p);
      this.showRoom();
      this.bindRoomActions();
    });
    this.ui.bindClick('[data-action="title"]', () => {
      this.showTitle();
    });
  }

  // ============================================================
  // DIALOGUE
  // ============================================================
  private currentDialogueIndex = 0;
  private dialogueResponse: string | null = null;

  private startDialogue(room: Room): void {
    if (!room.npcId) return;
    const npc = this.data.getNPC(room.npcId);
    if (!npc) return;

    this.state.scene = "dialogue";
    this.state.currentNPC = npc;
    this.currentDialogueIndex = 0;
    this.dialogueResponse = null;
    this.state.menuOpen = null;
    this.showDialogue();
  }

  private showDialogue(): void {
    const npc = this.state.currentNPC;
    if (!npc) { this.showRoom(); this.bindRoomActions(); return; }

    const displayText = this.dialogueResponse || npc.greeting;

    this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #080818 0%, #0a0a2d 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="dialogue-panel" style="animation:fadeIn 0.3s ease">
            <div class="npc-section">
              <div class="npc-portrait">${createEntitySVG(npc.portrait, npc.color, 80)}</div>
              <div class="npc-text">
                <div class="npc-name">${npc.name}</div>
                <div class="npc-dialogue">"${displayText}"</div>
              </div>
            </div>

            ${this.dialogueResponse ? `
              <div style="text-align:center;margin-top:16px">
                <button class="btn" data-action="back-to-choices">Ask something else</button>
                <button class="btn" data-action="leave-dialogue">Leave</button>
              </div>
            ` : `
              <div class="dialogue-choices">
                ${npc.dialogueOptions.map((opt, i) => `
                  <button class="btn dialogue-choice" data-dialogue="${i}">💬 ${opt.text}</button>
                `).join("")}
                <button class="btn dialogue-choice" data-action="leave-dialogue" style="color:#888">👋 Leave</button>
              </div>
            `}
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `);

    if (!this.dialogueResponse) {
      npc.dialogueOptions.forEach((_, i) => {
        this.ui.bindClick(`[data-dialogue="${i}"]`, () => this.selectDialogue(i));
      });
    }
    this.ui.bindClick('[data-action="back-to-choices"]', () => {
      this.dialogueResponse = null;
      this.showDialogue();
    });
    this.ui.bindClick('[data-action="leave-dialogue"]', () => {
      this.state.currentNPC = undefined;
      this.state.scene = "room";
      this.showRoom();
      this.bindRoomActions();
    });
    this.bindHUDMenus();
    this.bindMenuClose();
  }

  private selectDialogue(index: number): void {
    const npc = this.state.currentNPC;
    if (!npc) return;

    const option = npc.dialogueOptions[index];
    if (!option) return;

    this.dialogueResponse = option.response;

    // Apply effect
    if (option.effect) {
      const p = this.state.player;
      switch (option.effect.type) {
        case "giveItem":
          if (option.effect.itemId) {
            const item = this.data.getItem(option.effect.itemId);
            if (item) {
              const existing = p.inventory.find(i => i.id === item.id);
              if (existing) existing.quantity += item.quantity;
              else p.inventory.push(item);
            }
          }
          break;
        case "giveRune":
          if (option.effect.runeId) {
            const rune = this.data.getRune(option.effect.runeId);
            if (rune && !p.runes.find(r => r.id === rune.id)) {
              p.runes.push(rune);
              this.dialogueResponse += ` (Received rune: ${rune.symbol} ${rune.name})`;
            }
          }
          break;
        case "heal":
          const healAmt = option.effect.healAmount || 20;
          p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + healAmt);
          break;
      }
      saveGame(p);
    }

    // Remove option after use (simple: mark by replacing)
    npc.dialogueOptions.splice(index, 1, {
      ...option,
      text: option.text + " (done)",
      effect: undefined,
      response: "I've already helped you with that."
    });

    this.showDialogue();
  }

  // ============================================================
  // RUNE FORGE (G2 gate)
  // ============================================================
  private forgeRune1: string | null = null;
  private forgeRune2: string | null = null;
  private forgeResult: Spell | null = null;

  private showForge(): void {
    this.state.scene = "forge";
    this.state.menuOpen = null;
    const p = this.state.player;

    const recipe = (this.forgeRune1 && this.forgeRune2)
      ? this.data.findRecipe(this.forgeRune1, this.forgeRune2) : null;
    const resultSpell = recipe ? this.data.getSpell(recipe.resultSpellId) : null;
    const alreadyKnown = resultSpell ? p.spells.some(s => s.id === resultSpell.id) : false;

    const rune1Data = this.forgeRune1 ? this.data.getRune(this.forgeRune1) : null;
    const rune2Data = this.forgeRune2 ? this.data.getRune(this.forgeRune2) : null;

    this.ui.render(`
      <div class="game-container" style="background:linear-gradient(135deg, #180808 0%, #2d1a0a 50%, #180808 100%)">
        ${this.renderHUD()}
        <div class="main-area">
          <div class="forge-panel" style="animation:fadeIn 0.3s ease">
            <div class="forge-title">🔨 Rune Forge</div>
            <p style="text-align:center;color:#aaa;margin-bottom:16px">Select two runes to combine and forge a spell.</p>

            <div class="rune-grid">
              ${p.runes.map(rune => {
                const selected = this.forgeRune1 === rune.id || this.forgeRune2 === rune.id;
                return `
                  <div class="rune-slot ${selected ? "selected" : ""}" data-rune="${rune.id}" title="${rune.description}">
                    <span class="rune-symbol">${rune.symbol}</span>
                    <span class="rune-name">${rune.name}</span>
                  </div>
                `;
              }).join("")}
              ${p.runes.length === 0 ? '<p style="color:#666">No runes collected yet. Explore the dungeon!</p>' : ""}
            </div>

            <div class="forge-selection">
              <div class="forge-slot ${rune1Data ? "filled" : ""}">
                ${rune1Data ? rune1Data.symbol : "?"}
              </div>
              <div class="forge-plus">+</div>
              <div class="forge-slot ${rune2Data ? "filled" : ""}">
                ${rune2Data ? rune2Data.symbol : "?"}
              </div>
              <div class="forge-arrow">=</div>
              <div class="forge-result">
                ${resultSpell
                  ? `<div class="forge-result-name">${getSpellIcon(resultSpell.element)} ${resultSpell.name}</div>
                     <div class="forge-result-desc">${resultSpell.description}</div>
                     <div class="forge-result-desc" style="color:#48f">${resultSpell.manaCost} MP | ${resultSpell.damage > 0 ? resultSpell.damage + " dmg" : resultSpell.description}</div>
                     ${alreadyKnown ? '<div style="color:#888;font-size:0.75rem">(Already known)</div>' : ""}`
                  : (this.forgeRune1 && this.forgeRune2)
                    ? '<div style="color:#844">No valid combination</div>'
                    : '<div style="color:#666">Select two runes</div>'
                }
              </div>
            </div>

            <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
              ${resultSpell && !alreadyKnown
                ? '<button class="btn btn-primary" data-action="craft">✨ Forge Spell</button>'
                : ""}
              <button class="btn btn-small" data-action="clear-forge">Clear</button>
              <button class="btn" data-action="leave-forge">Leave Forge</button>
            </div>

            ${p.spells.length > 0 ? `
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #333">
                <div style="font-size:0.85rem;color:#888;margin-bottom:8px">Known Spells:</div>
                ${p.spells.map(s => `
                  <div class="spell-row">
                    <span class="spell-icon">${getSpellIcon(s.element)}</span>
                    <div class="spell-info">
                      <div class="spell-name">${s.name}</div>
                      <div class="spell-desc">${s.description}</div>
                    </div>
                    <span class="spell-cost">${s.manaCost} MP</span>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          </div>
          ${this.renderMenuOverlay()}
        </div>
      </div>
    `);

    // Bind rune selection
    p.runes.forEach(rune => {
      this.ui.bindClick(`[data-rune="${rune.id}"]`, () => this.selectForgeRune(rune.id));
    });

    this.ui.bindClick('[data-action="craft"]', () => this.craftSpell());
    this.ui.bindClick('[data-action="clear-forge"]', () => {
      this.forgeRune1 = null;
      this.forgeRune2 = null;
      this.forgeResult = null;
      this.showForge();
    });
    this.ui.bindClick('[data-action="leave-forge"]', () => {
      this.forgeRune1 = null;
      this.forgeRune2 = null;
      this.forgeResult = null;
      this.state.scene = "room";
      this.showRoom();
      this.bindRoomActions();
    });

    this.bindHUDMenus();
    this.bindMenuClose();
  }

  private selectForgeRune(runeId: string): void {
    if (this.forgeRune1 === runeId) {
      this.forgeRune1 = null;
    } else if (this.forgeRune2 === runeId) {
      this.forgeRune2 = null;
    } else if (!this.forgeRune1) {
      this.forgeRune1 = runeId;
    } else if (!this.forgeRune2) {
      this.forgeRune2 = runeId;
    } else {
      // Both slots full, replace first
      this.forgeRune1 = this.forgeRune2;
      this.forgeRune2 = runeId;
    }
    this.showForge();
  }

  private craftSpell(): void {
    if (!this.forgeRune1 || !this.forgeRune2) return;
    const recipe = this.data.findRecipe(this.forgeRune1, this.forgeRune2);
    if (!recipe) return;

    const spell = this.data.getSpell(recipe.resultSpellId);
    if (!spell) return;

    const p = this.state.player;
    if (p.spells.some(s => s.id === spell.id)) return;

    p.spells.push({ ...spell });
    saveGame(p);

    this.forgeRune1 = null;
    this.forgeRune2 = null;
    this.forgeResult = null;
    this.showForge();
  }

  // ============================================================
  // ITEM USE (out of combat)
  // ============================================================
  private useItem(index: number): void {
    const p = this.state.player;
    const item = p.inventory[index];
    if (!item || !item.effect) return;

    const stat = item.effect.stat;
    if (stat === "currentHp") {
      p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + item.effect.value);
    } else if (stat === "currentMana") {
      p.combatStats.currentMana = Math.min(p.combatStats.maxMana, p.combatStats.currentMana + item.effect.value);
    }

    item.quantity--;
    if (item.quantity <= 0) {
      p.inventory.splice(index, 1);
    }

    saveGame(p);
    this.rerenderScene();
  }
}
