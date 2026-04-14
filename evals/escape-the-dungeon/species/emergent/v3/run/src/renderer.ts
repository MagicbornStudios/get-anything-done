// DOM-based renderer for the game UI
import type {
  GameState,
  ContentPacks,
  RoomData,
  FloorData,
  Entity,
  Spell,
  Item,
  PlayerState,
} from "./types";
import { getIconSvg } from "./icons";
import {
  getCurrentFloor,
  getCurrentRoom,
  saveGame,
  gainXp,
  createEnemy,
} from "./state";

type GameView = "title" | "room" | "combat" | "dialogue" | "forge" | "treasure" | "rest" | "gameover" | "victory";

interface CombatState {
  enemy: Entity;
  log: { text: string; cls: string }[];
  playerTurn: boolean;
  subView: "actions" | "spells" | "items";
  done: boolean;
  won: boolean;
}

interface DialogueState {
  npcId: string;
  responseText: string | null;
}

interface ForgeState {
  selectedRunes: string[];
  result: Spell | null;
}

let root: HTMLElement;
let state: GameState;
let content: ContentPacks;
let currentView: GameView = "title";
let sideTab: "map" | "bag" | "spells" | "stats" = "map";
let combatState: CombatState | null = null;
let dialogueState: DialogueState | null = null;
let forgeState: ForgeState = { selectedRunes: [], result: null };

export function initRenderer(
  rootEl: HTMLElement,
  gameState: GameState,
  contentPacks: ContentPacks
): void {
  root = rootEl;
  state = gameState;
  content = contentPacks;
  render();
}

export function setGameState(gs: GameState): void {
  state = gs;
}

function h(tag: string, attrs: Record<string, any> = {}, ...children: (string | HTMLElement | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") el.className = v;
    else if (k === "innerHTML") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "disabled") { if (v) el.setAttribute("disabled", ""); }
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null) continue;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}

function icon(name: string, className: string = ""): HTMLElement {
  const span = h("span", { className, innerHTML: getIconSvg(name) });
  return span;
}

function barEl(current: number, max: number, cls: string, label?: string): HTMLElement {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return h("div", { className: "bar-container" },
    h("div", { className: `bar-fill ${cls}`, style: `width:${pct}%` }),
    h("div", { className: "bar-text" }, label || `${current}/${max}`)
  );
}

function render(): void {
  root.innerHTML = "";
  switch (currentView) {
    case "title": renderTitle(); break;
    case "room": renderRoom(); break;
    case "combat": renderCombat(); break;
    case "dialogue": renderDialogue(); break;
    case "forge": renderForge(); break;
    case "treasure": renderTreasure(); break;
    case "rest": renderRest(); break;
    case "gameover": renderGameOver(); break;
    case "victory": renderVictory(); break;
  }
}

// ===== TITLE SCREEN =====
function renderTitle(): void {
  const screen = h("div", { className: "title-screen" },
    h("h1", {}, "Escape the Dungeon"),
    h("div", { className: "subtitle" }, "A roguelike dungeon crawler"),
    h("button", { className: "title-btn", onClick: () => startNewGame() }, "New Game"),
  );

  // Check for save
  const saved = localStorage.getItem("escape-dungeon-save");
  if (saved) {
    screen.insertBefore(
      h("button", { className: "title-btn", onClick: () => loadSavedGame() }, "Continue"),
      screen.lastElementChild
    );
  }

  root.appendChild(screen);
}

function startNewGame(): void {
  const { createGameState } = require("./state") as any;
  // We already have state from init
  currentView = "room";
  saveGame(state);
  render();
}

function loadSavedGame(): void {
  const { loadGame } = require("./state") as any;
  const loaded = loadGame();
  if (loaded) {
    state = loaded;
    currentView = "room";
    render();
  }
}

// ===== HUD BAR =====
function renderHud(): HTMLElement {
  const p = state.player;
  return h("div", { className: "hud-bar" },
    h("div", { className: "hud-item" },
      icon("health", "hud-icon"),
      h("span", { className: "hud-label" }, "HP"),
      barEl(p.combatStats.currentHp, p.combatStats.maxHp, "hp"),
    ),
    h("div", { className: "hud-item" },
      icon("mana", "hud-icon"),
      h("span", { className: "hud-label" }, "Mana"),
      barEl(p.combatStats.currentMana, p.combatStats.maxMana, "mana"),
    ),
    h("div", { className: "hud-item" },
      icon("xp", "hud-icon"),
      h("span", { className: "hud-label" }, "XP"),
      barEl(p.xp, p.xpToNext, "xp"),
    ),
    h("div", { className: "hud-item" },
      icon("crystal", "hud-icon"),
      h("span", { className: "hud-value", style: "color:#44ddff" }, String(p.crystals)),
    ),
    h("div", { className: "hud-item" },
      h("span", { className: "hud-label" }, "Lv"),
      h("span", { className: "hud-value" }, String(p.level)),
    ),
    h("div", { className: "hud-item" },
      h("span", { className: "hud-label" }, "Floor"),
      h("span", { className: "hud-value" }, String(state.currentFloorIndex + 1)),
    ),
    h("div", { className: "hud-item" },
      h("span", { className: "hud-label" }, "Tick"),
      h("span", { className: "hud-value" }, String(state.dungeonTick)),
    ),
  );
}

// ===== ROOM VIEW =====
function renderRoom(): void {
  const floor = getCurrentFloor(state, content);
  const room = getCurrentRoom(state, content);

  const container = h("div", { className: "", style: "display:flex;flex-direction:column;height:100vh" },
    renderHud(),
    h("div", { className: "game-content" },
      renderRoomPanel(floor, room),
      renderSidePanel(floor),
    )
  );
  root.appendChild(container);
}

function renderRoomPanel(floor: FloorData, room: RoomData): HTMLElement {
  const panel = h("div", { className: "room-panel" },
    h("div", { className: "room-header" },
      icon(room.feature, `room-icon ${room.feature}`),
      h("div", {},
        h("div", { className: "room-name" }, room.name),
        h("div", { style: "font-size:0.8rem;color:#666" }, `${floor.name} - ${featureLabel(room.feature)}`),
      ),
    ),
    h("div", { className: "room-desc" }, room.description),
  );

  // Show floor constraint hint on first visit
  if (floor.mechanicalConstraint) {
    panel.appendChild(
      h("div", { className: "floor-constraint" }, `Tip: ${floor.mechanicalConstraint}`)
    );
  }

  // Room-specific interaction
  if (room.feature === "combat" && room.enemy && !state.clearedRooms.has(room.id)) {
    panel.appendChild(
      h("button", {
        className: "action-btn fight",
        style: "align-self:flex-start;margin-bottom:16px",
        onClick: () => enterCombat(room),
      },
        icon("sword", "btn-icon"),
        "Engage Enemy",
      )
    );
  } else if (room.feature === "combat" && state.clearedRooms.has(room.id)) {
    panel.appendChild(
      h("div", { style: "color:#66ff99;margin-bottom:16px;font-style:italic" }, "This room has been cleared.")
    );
  }

  if (room.feature === "dialogue" && room.npcId) {
    panel.appendChild(
      h("button", {
        className: "action-btn items",
        style: "align-self:flex-start;margin-bottom:16px",
        onClick: () => enterDialogue(room),
      },
        icon("dialogue", "btn-icon"),
        "Talk",
      )
    );
  }

  if (room.feature === "rune_forge") {
    panel.appendChild(
      h("button", {
        className: "action-btn spells",
        style: "align-self:flex-start;margin-bottom:16px",
        onClick: () => enterForge(),
      },
        icon("rune_forge", "btn-icon"),
        "Use Forge",
      )
    );
  }

  if (room.feature === "treasure" && !state.clearedRooms.has(room.id)) {
    panel.appendChild(
      h("button", {
        className: "action-btn items",
        style: "align-self:flex-start;margin-bottom:16px",
        onClick: () => openTreasure(room),
      },
        icon("treasure", "btn-icon"),
        "Open Chest",
      )
    );
  } else if (room.feature === "treasure" && state.clearedRooms.has(room.id)) {
    panel.appendChild(
      h("div", { style: "color:#888;margin-bottom:16px;font-style:italic" }, "The chest has been opened.")
    );
  }

  if (room.feature === "rest") {
    panel.appendChild(
      h("button", {
        className: "action-btn flee",
        style: "align-self:flex-start;margin-bottom:16px",
        onClick: () => enterRest(),
      },
        icon("rest", "btn-icon"),
        "Rest",
      )
    );
  }

  if (room.feature === "escape_gate") {
    currentView = "victory";
    state.victory = true;
    render();
    return panel;
  }

  // Navigation
  panel.appendChild(renderNavigation(floor, room));

  return panel;
}

function renderNavigation(floor: FloorData, room: RoomData): HTMLElement {
  const nav = h("div", { className: "nav-section" },
    h("div", { className: "nav-title" }, "Exits"),
    h("div", { className: "nav-grid" }),
  );
  const grid = nav.querySelector(".nav-grid")!;

  for (const [dir, targetId] of Object.entries(room.exits)) {
    const targetRoom = floor.rooms.find(r => r.id === targetId);
    // Check if boss room requires clearing current floor
    if (targetRoom && targetRoom.feature === "combat" && targetRoom.enemy?.isBoss) {
      // Boss is always visible
    }
    const discovered = state.discoveredRooms.has(targetId as string);
    const featureTag = discovered && targetRoom
      ? h("span", { className: `room-type-tag tag-${targetRoom.feature}` }, featureLabel(targetRoom.feature))
      : h("span", { className: "room-type-tag tag-unknown" }, "???");

    const btn = h("button", {
      className: "nav-btn",
      onClick: () => moveToRoom(targetId as string, floor),
    },
      icon(dir, "nav-icon"),
      h("span", {}, dirLabel(dir)),
      featureTag,
    );
    grid.appendChild(btn);
  }

  return nav;
}

function moveToRoom(roomId: string, floor: FloorData): void {
  // Handle floor transition
  if (roomId.startsWith("f") && !floor.rooms.find(r => r.id === roomId)) {
    // Moving to next floor
    const nextFloorIndex = state.currentFloorIndex + 1;
    if (nextFloorIndex < content.floors.floors.length) {
      state.currentFloorIndex = nextFloorIndex;
      const nextFloor = content.floors.floors[nextFloorIndex];
      const startRoom = nextFloor.rooms.find(r => r.feature === "start")!;
      state.currentRoomId = startRoom.id;
      state.discoveredRooms.add(startRoom.id);
      for (const tid of Object.values(startRoom.exits)) {
        state.discoveredRooms.add(tid as string);
      }
    }
  } else {
    state.currentRoomId = roomId;
  }

  state.dungeonTick++;

  // Discover adjacent rooms
  const newRoom = getCurrentRoom(state, content);
  state.discoveredRooms.add(roomId);
  if (newRoom) {
    for (const tid of Object.values(newRoom.exits)) {
      state.discoveredRooms.add(tid as string);
    }
  }

  saveGame(state);
  currentView = "room";
  render();
}

// ===== SIDE PANEL =====
function renderSidePanel(floor: FloorData): HTMLElement {
  const panel = h("div", { className: "side-panel" },
    h("div", { className: "side-tabs" },
      tabBtn("map", "Map"),
      tabBtn("bag", "Bag"),
      tabBtn("spells", "Spells"),
      tabBtn("stats", "Stats"),
    ),
    h("div", { className: "side-content" }),
  );

  const contentEl = panel.querySelector(".side-content")!;
  switch (sideTab) {
    case "map": contentEl.appendChild(renderMapTab(floor)); break;
    case "bag": contentEl.appendChild(renderBagTab()); break;
    case "spells": contentEl.appendChild(renderSpellsTab()); break;
    case "stats": contentEl.appendChild(renderStatsTab()); break;
  }

  return panel as HTMLElement;
}

function tabBtn(tab: typeof sideTab, label: string): HTMLElement {
  return h("div", {
    className: `side-tab ${sideTab === tab ? "active" : ""}`,
    onClick: () => { sideTab = tab; render(); },
  }, label);
}

function renderMapTab(floor: FloorData): HTMLElement {
  const grid = h("div", { className: "map-grid" });
  for (const room of floor.rooms) {
    const isCurrent = room.id === state.currentRoomId;
    const isDiscovered = state.discoveredRooms.has(room.id);
    const isCleared = state.clearedRooms.has(room.id);

    const cls = isCurrent ? "map-room current" : isDiscovered ? "map-room discovered" : "map-room undiscovered";
    const nameText = isDiscovered ? room.name : "???";
    const featureText = isDiscovered ? featureLabel(room.feature) : "";

    const row = h("div", { className: cls },
      icon(isDiscovered ? room.feature : "start", "map-room-icon"),
      h("span", { style: "flex:1" }, nameText),
      isDiscovered
        ? h("span", { className: `room-type-tag tag-${room.feature}`, style: "font-size:0.65rem" }, featureText)
        : null,
      isCleared ? h("span", { style: "color:#66ff99;font-size:0.7rem;margin-left:4px" }, "Cleared") : null,
    );
    grid.appendChild(row);
  }
  return grid;
}

function renderBagTab(): HTMLElement {
  const container = h("div", {});
  container.appendChild(h("div", { className: "stat-group-title" }, "Inventory"));
  const list = h("div", { className: "item-list" });

  if (state.player.inventory.length === 0) {
    list.appendChild(h("div", { style: "color:#666;font-style:italic;padding:8px" }, "No items"));
  }

  for (const item of state.player.inventory) {
    list.appendChild(
      h("div", { className: "item-entry" },
        icon(item.icon || "bag", "spell-icon"),
        h("span", { className: "spell-name" }, `${item.name} x${item.quantity}`),
        h("span", { className: "spell-desc" }, item.description),
      )
    );
  }

  container.appendChild(list);

  // Runes
  container.appendChild(h("div", { className: "stat-group-title", style: "margin-top:12px" }, "Runes"));
  const runeList = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px" });
  if (state.player.runes.length === 0) {
    runeList.appendChild(h("div", { style: "color:#666;font-style:italic;padding:8px" }, "No runes"));
  }
  for (const runeId of state.player.runes) {
    const runeData = content.spells.runes[runeId];
    if (runeData) {
      runeList.appendChild(
        h("div", {
          style: `display:flex;align-items:center;gap:4px;padding:4px 8px;background:${runeData.color}22;border:1px solid ${runeData.color}44;border-radius:4px`,
        },
          icon(runeData.element, "spell-icon"),
          h("span", { style: `color:${runeData.color};font-size:0.8rem` }, runeData.name),
        )
      );
    }
  }
  container.appendChild(runeList);

  return container;
}

function renderSpellsTab(): HTMLElement {
  const container = h("div", {});
  container.appendChild(h("div", { className: "stat-group-title" }, `Spells (${state.player.spells.length}/${state.player.spellSlots})`));
  const list = h("div", { className: "spell-list" });

  for (const spell of state.player.spells) {
    list.appendChild(
      h("div", { className: "spell-item" },
        icon(spell.element || "spell", "spell-icon"),
        h("div", { style: "flex:1" },
          h("div", { className: "spell-name" }, spell.name),
          h("div", { className: "spell-desc" }, spell.description),
        ),
        h("span", { className: "spell-cost" }, `${spell.manaCost} MP`),
      )
    );
  }

  container.appendChild(list);

  // Rune affinity
  if (Object.keys(state.player.runeAffinity).length > 0) {
    container.appendChild(h("div", { className: "stat-group-title", style: "margin-top:12px" }, "Rune Affinity"));
    for (const [runeId, level] of Object.entries(state.player.runeAffinity)) {
      const runeData = content.spells.runes[runeId];
      if (!runeData) continue;
      const maxAff = 10;
      container.appendChild(
        h("div", { className: "affinity-row" },
          icon(runeData.element, "spell-icon"),
          h("span", { style: `color:${runeData.color};font-size:0.8rem;width:50px` }, runeData.name),
          h("div", { className: "affinity-bar" },
            h("div", {
              className: "affinity-fill",
              style: `width:${(level as number / maxAff) * 100}%;background:${runeData.color}`,
            }),
          ),
          h("span", { className: "affinity-level" }, String(level)),
        )
      );
    }
  }

  return container;
}

function renderStatsTab(): HTMLElement {
  const p = state.player;
  const container = h("div", {});

  container.appendChild(h("div", { className: "stat-group-title" }, "Combat Stats"));
  const stats = [
    ["Might", p.combatStats.might],
    ["Agility", p.combatStats.agility],
    ["Insight", p.combatStats.insight],
    ["Willpower", p.combatStats.willpower],
    ["Defense", p.combatStats.defense],
    ["Power", p.combatStats.power],
  ];
  for (const [label, val] of stats) {
    container.appendChild(
      h("div", { className: "stat-row" },
        h("span", { className: "stat-label" }, label as string),
        h("span", { className: "stat-value" }, String(val)),
      )
    );
  }

  container.appendChild(h("div", { className: "stat-group-title", style: "margin-top:12px" }, "Traits"));
  container.appendChild(
    h("div", { className: "stat-row" },
      h("span", { className: "stat-label" }, "Level"),
      h("span", { className: "stat-value" }, String(p.level)),
    )
  );
  container.appendChild(
    h("div", { className: "stat-row" },
      h("span", { className: "stat-label" }, "Kills"),
      h("span", { className: "stat-value" }, String(p.killCount)),
    )
  );

  return container;
}

// ===== COMBAT =====
function enterCombat(room: RoomData): void {
  const enemy = createEnemy(room, content);
  combatState = {
    enemy,
    log: [{ text: `A ${enemy.name} (Lv.${enemy.level}) appears!`, cls: "log-info" }],
    playerTurn: true,
    subView: "actions",
    done: false,
    won: false,
  };

  // Manadrain aura
  if (room.manadrainAura) {
    combatState.log.push({ text: "A mana-draining aura fills the room! (-5 mana per turn)", cls: "log-status" });
  }

  currentView = "combat";
  render();
}

function renderCombat(): void {
  if (!combatState) return;
  const cs = combatState;
  const p = state.player;

  const container = h("div", { style: "display:flex;flex-direction:column;height:100vh" },
    renderHud(),
    h("div", { className: "combat-view" },
      // Enemy display
      h("div", { className: "combat-enemy" },
        icon(cs.enemy.entityType, "enemy-portrait"),
        h("div", { className: "enemy-info" },
          h("div", { className: "enemy-name" }, cs.enemy.name),
          h("div", { className: "enemy-level" }, `Level ${cs.enemy.level}${cs.enemy.isBoss ? " - BOSS" : ""}`),
          barEl(cs.enemy.combatStats.currentHp, cs.enemy.combatStats.maxHp, "enemy-hp"),
          renderStatusEffects(cs.enemy.statusEffects),
          cs.enemy.resistances ? renderResistances(cs.enemy.resistances) : null,
        ),
      ),
      // Player status effects
      renderStatusEffects(p.statusEffects),
      // Combat log
      renderCombatLog(),
      // Actions
      cs.done ? renderCombatResult() : renderCombatActions(),
    ),
  );
  root.appendChild(container);
}

function renderStatusEffects(effects: { type: string; turns: number }[]): HTMLElement {
  const container = h("div", { className: "status-effects" });
  for (const eff of effects) {
    container.appendChild(
      h("span", { className: `status-badge ${eff.type}` }, `${eff.type} (${eff.turns}t)`)
    );
  }
  return container;
}

function renderResistances(res: Record<string, number>): HTMLElement {
  const container = h("div", { style: "font-size:0.7rem;color:#aa8866;margin-top:4px" });
  const parts: string[] = [];
  for (const [type, val] of Object.entries(res)) {
    parts.push(`${type}: ${Math.round(val * 100)}% resist`);
  }
  container.textContent = parts.join(", ");
  return container;
}

function renderCombatLog(): HTMLElement {
  const log = h("div", { className: "combat-log" });
  for (const entry of combatState!.log) {
    log.appendChild(h("div", { className: entry.cls }, entry.text));
  }
  // Auto scroll
  setTimeout(() => log.scrollTop = log.scrollHeight, 10);
  return log;
}

function renderCombatActions(): HTMLElement {
  const cs = combatState!;
  const p = state.player;

  if (!cs.playerTurn) {
    // Enemy turn auto-processes
    return h("div", { className: "combat-actions" },
      h("div", { style: "color:#888;font-style:italic" }, "Enemy is acting..."),
    );
  }

  if (cs.subView === "spells") return renderSpellSelect();
  if (cs.subView === "items") return renderItemSelect();

  return h("div", { className: "combat-actions" },
    h("button", {
      className: "action-btn fight",
      onClick: () => doFight(),
    }, icon("sword", "btn-icon"), "Fight"),
    h("button", {
      className: "action-btn spells",
      onClick: () => { cs.subView = "spells"; render(); },
      disabled: p.spells.length === 0,
    }, icon("spell", "btn-icon"), "Spells"),
    h("button", {
      className: "action-btn items",
      onClick: () => { cs.subView = "items"; render(); },
      disabled: p.inventory.filter(i => i.type === "consumable").length === 0,
    }, icon("bag", "btn-icon"), "Bag"),
    h("button", {
      className: "action-btn flee",
      onClick: () => doFlee(),
    }, icon("run", "btn-icon"), "Run"),
  );
}

function renderSpellSelect(): HTMLElement {
  const container = h("div", { style: "display:flex;flex-direction:column;gap:6px;width:100%" });
  container.appendChild(
    h("button", {
      className: "nav-btn",
      style: "align-self:flex-start;margin-bottom:8px",
      onClick: () => { combatState!.subView = "actions"; render(); },
    }, "Back")
  );

  const list = h("div", { className: "spell-list" });
  for (const spell of state.player.spells) {
    const canCast = state.player.combatStats.currentMana >= spell.manaCost;
    list.appendChild(
      h("div", {
        className: "spell-item",
        style: canCast ? "" : "opacity:0.4;cursor:not-allowed",
        onClick: canCast ? () => doCastSpell(spell) : undefined,
      },
        icon(spell.element || "spell", "spell-icon"),
        h("div", { style: "flex:1" },
          h("div", { className: "spell-name" }, spell.name),
          h("div", { className: "spell-desc" }, spell.description),
        ),
        h("span", { className: "spell-cost" }, `${spell.manaCost} MP`),
      )
    );
  }
  container.appendChild(list);
  return container;
}

function renderItemSelect(): HTMLElement {
  const container = h("div", { style: "display:flex;flex-direction:column;gap:6px;width:100%" });
  container.appendChild(
    h("button", {
      className: "nav-btn",
      style: "align-self:flex-start;margin-bottom:8px",
      onClick: () => { combatState!.subView = "actions"; render(); },
    }, "Back")
  );

  const list = h("div", { className: "item-list" });
  for (const item of state.player.inventory.filter(i => i.type === "consumable")) {
    list.appendChild(
      h("div", {
        className: "item-entry",
        onClick: () => doUseItem(item),
      },
        icon(item.icon || "bag", "spell-icon"),
        h("span", { className: "spell-name" }, `${item.name} x${item.quantity}`),
        h("span", { className: "spell-desc" }, item.description),
      )
    );
  }
  container.appendChild(list);
  return container;
}

function renderCombatResult(): HTMLElement {
  const cs = combatState!;
  return h("div", { className: "combat-actions" },
    h("button", {
      className: "title-btn",
      onClick: () => {
        if (cs.won) {
          currentView = "room";
        } else {
          currentView = "gameover";
          state.gameOver = true;
        }
        combatState = null;
        render();
      },
    }, cs.won ? "Continue" : "Game Over"),
  );
}

// ===== COMBAT LOGIC =====
function doFight(): void {
  const cs = combatState!;
  const p = state.player;
  const e = cs.enemy;

  let damage = Math.max(1, p.combatStats.might - Math.floor(e.combatStats.defense * 0.5));
  // Physical resistance
  if (e.resistances?.physical) {
    const reduced = Math.floor(damage * e.resistances.physical);
    damage -= reduced;
    if (reduced > 0) {
      cs.log.push({ text: `Physical resistance absorbs ${reduced} damage!`, cls: "log-resist" });
    }
  }
  damage = Math.max(1, damage);

  e.combatStats.currentHp -= damage;
  cs.log.push({ text: `You strike for ${damage} damage!`, cls: "log-player" });

  checkCombatEnd();
}

function doCastSpell(spell: Spell): void {
  const cs = combatState!;
  const p = state.player;
  const e = cs.enemy;

  p.combatStats.currentMana -= spell.manaCost;
  cs.log.push({ text: `You cast ${spell.name}!`, cls: "log-player" });

  // Check spell reflection
  if (e.reflectSpells && spell.type === "direct") {
    const reflectDmg = Math.floor(spell.damage * 0.5);
    p.combatStats.currentHp -= reflectDmg;
    cs.log.push({ text: `The ${e.name} reflects ${reflectDmg} damage back at you!`, cls: "log-critical" });
    // Also reduce effect on enemy
    const reduced = Math.floor(spell.damage * 0.2);
    e.combatStats.currentHp -= reduced;
    cs.log.push({ text: `Only ${reduced} damage gets through!`, cls: "log-damage" });
  } else if (spell.type === "direct") {
    let damage = spell.damage + Math.floor(p.combatStats.power * 0.3);
    // Direct spell resistance
    if (e.resistances?.direct_spell) {
      const reduced = Math.floor(damage * e.resistances.direct_spell);
      damage -= reduced;
      if (reduced > 0) cs.log.push({ text: `Spell resistance absorbs ${reduced}!`, cls: "log-resist" });
    }
    damage = Math.max(1, damage);
    e.combatStats.currentHp -= damage;
    cs.log.push({ text: `${spell.name} deals ${damage} damage!`, cls: "log-damage" });
  } else if (spell.type === "dot") {
    // DoT spells bypass physical/spell resistance
    const initDmg = spell.damage + Math.floor(p.combatStats.power * 0.2);
    e.combatStats.currentHp -= initDmg;
    cs.log.push({ text: `${spell.name} deals ${initDmg} initial damage!`, cls: "log-damage" });
    e.statusEffects.push({
      type: spell.element === "fire" ? "burn" : "poison",
      turns: spell.dotTurns || 3,
      damage: (spell.dotDamage || 5) + Math.floor(p.combatStats.power * 0.1),
    });
    cs.log.push({ text: `${e.name} is affected by ${spell.element === "fire" ? "burn" : "poison"}!`, cls: "log-status" });
  } else if (spell.type === "drain") {
    let damage = spell.damage + Math.floor(p.combatStats.power * 0.3);
    e.combatStats.currentHp -= damage;
    const healed = Math.floor(damage * (spell.healPercent || 0.5));
    p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + healed);
    cs.log.push({ text: `${spell.name} drains ${damage} HP, healing you for ${healed}!`, cls: "log-heal" });
  } else if (spell.type === "buff") {
    p.buffedStats[spell.buffStat!] = { amount: spell.buffAmount!, turns: spell.buffTurns! };
    cs.log.push({ text: `${spell.name} boosts your ${spell.buffStat} by ${spell.buffAmount}!`, cls: "log-info" });
  } else if (spell.type === "restore_mana") {
    const restored = spell.restoreMana || 20;
    p.combatStats.currentMana = Math.min(p.combatStats.maxMana, p.combatStats.currentMana + restored);
    cs.log.push({ text: `${spell.name} restores ${restored} mana!`, cls: "log-heal" });
  }

  // Status effect from spell
  if (spell.statusEffect && spell.type !== "dot") {
    e.statusEffects.push({ type: spell.statusEffect.type, turns: spell.statusEffect.turns });
    cs.log.push({ text: `${e.name} is ${spell.statusEffect.type}ed!`, cls: "log-status" });
  }

  // Increase rune affinity for runes used
  for (const runeId of spell.runes) {
    p.runeAffinity[runeId] = (p.runeAffinity[runeId] || 0) + 0.2;
  }

  checkCombatEnd();
}

function doUseItem(item: Item): void {
  const cs = combatState!;
  const p = state.player;

  if (item.effect) {
    if ((item.effect as any).healHp) {
      const healed = (item.effect as any).healHp;
      p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + healed);
      cs.log.push({ text: `Used ${item.name}: healed ${healed} HP!`, cls: "log-heal" });
    }
    if ((item.effect as any).healMana) {
      const restored = (item.effect as any).healMana;
      p.combatStats.currentMana = Math.min(p.combatStats.maxMana, p.combatStats.currentMana + restored);
      cs.log.push({ text: `Used ${item.name}: restored ${restored} mana!`, cls: "log-heal" });
    }
    if ((item.effect as any).cureStatus) {
      p.statusEffects = p.statusEffects.filter(s => s.type !== (item.effect as any).cureStatus);
      cs.log.push({ text: `Used ${item.name}: cured ${(item.effect as any).cureStatus}!`, cls: "log-info" });
    }
  }

  item.quantity--;
  if (item.quantity <= 0) {
    state.player.inventory = state.player.inventory.filter(i => i.id !== item.id);
  }

  cs.subView = "actions";
  endPlayerTurn();
}

function doFlee(): void {
  const cs = combatState!;
  const p = state.player;
  const e = cs.enemy;

  const fleeChance = 0.4 + (p.combatStats.agility - e.combatStats.agility) * 0.05;
  if (Math.random() < fleeChance) {
    cs.log.push({ text: "You escaped!", cls: "log-info" });
    cs.done = true;
    cs.won = false;
    // Don't set game over on flee - return to room
    setTimeout(() => {
      combatState = null;
      currentView = "room";
      render();
    }, 800);
  } else {
    cs.log.push({ text: "Failed to escape!", cls: "log-enemy" });
    endPlayerTurn();
  }
  render();
}

function endPlayerTurn(): void {
  const cs = combatState!;
  if (cs.done) return;

  cs.playerTurn = false;
  render();

  // Process buffs
  const p = state.player;
  for (const [stat, buff] of Object.entries(p.buffedStats)) {
    buff.turns--;
    if (buff.turns <= 0) {
      delete p.buffedStats[stat];
      cs.log.push({ text: `${stat} buff wore off.`, cls: "log-info" });
    }
  }

  setTimeout(() => enemyTurn(), 600);
}

function enemyTurn(): void {
  const cs = combatState!;
  if (cs.done) return;
  const p = state.player;
  const e = cs.enemy;

  // Process enemy status effects
  const activeEffects = [...e.statusEffects];
  for (const eff of activeEffects) {
    if (eff.damage) {
      e.combatStats.currentHp -= eff.damage;
      cs.log.push({ text: `${e.name} takes ${eff.damage} ${eff.type} damage!`, cls: "log-damage" });
    }
    eff.turns--;
  }
  e.statusEffects = e.statusEffects.filter(s => s.turns > 0);

  // Check if enemy died from DoT
  if (e.combatStats.currentHp <= 0) {
    combatVictory();
    return;
  }

  // Check if enemy is frozen
  const frozen = e.statusEffects.find(s => s.type === "freeze");
  if (frozen) {
    cs.log.push({ text: `${e.name} is frozen and cannot act!`, cls: "log-status" });
    cs.playerTurn = true;
    render();
    return;
  }

  // Manadrain aura
  if (e.manadrainAura) {
    const drain = 5;
    p.combatStats.currentMana = Math.max(0, p.combatStats.currentMana - drain);
    cs.log.push({ text: `Mana-drain aura saps ${drain} mana!`, cls: "log-status" });
  }

  // Enemy attack
  let damage = Math.max(1, e.combatStats.might - Math.floor(p.combatStats.defense * 0.4));
  // Apply player defense buff
  if (p.buffedStats["defense"]) {
    damage = Math.max(1, damage - p.buffedStats["defense"].amount);
  }

  // Slow debuff reduces enemy damage
  const slowed = e.statusEffects.find(s => s.type === "slow");
  if (slowed) {
    damage = Math.floor(damage * 0.7);
    cs.log.push({ text: `${e.name} attacks sluggishly while slowed.`, cls: "log-status" });
  }

  p.combatStats.currentHp -= damage;
  cs.log.push({ text: `${e.name} attacks for ${damage} damage!`, cls: "log-enemy" });

  // Process player status effects
  for (const eff of [...p.statusEffects]) {
    if (eff.damage) {
      p.combatStats.currentHp -= eff.damage;
      cs.log.push({ text: `You take ${eff.damage} ${eff.type} damage!`, cls: "log-damage" });
    }
    eff.turns--;
  }
  p.statusEffects = p.statusEffects.filter(s => s.turns > 0);

  if (p.combatStats.currentHp <= 0) {
    p.combatStats.currentHp = 0;
    cs.log.push({ text: "You have been defeated!", cls: "log-critical" });
    cs.done = true;
    cs.won = false;
  } else {
    cs.playerTurn = true;
  }
  render();
}

function checkCombatEnd(): void {
  const cs = combatState!;
  if (cs.enemy.combatStats.currentHp <= 0) {
    combatVictory();
    return;
  }
  cs.subView = "actions";
  endPlayerTurn();
}

function combatVictory(): void {
  const cs = combatState!;
  const p = state.player;
  const e = cs.enemy;

  cs.enemy.combatStats.currentHp = 0;
  cs.log.push({ text: `${e.name} defeated!`, cls: "log-heal" });

  // Rewards
  const xpReward = 10 + e.level * 5 + (e.isBoss ? 30 : 0);
  const crystalReward = 3 + e.level * 2 + (e.isBoss ? 15 : 0);

  const levelMsgs = gainXp(p, xpReward);
  p.crystals += crystalReward;
  p.killCount++;

  cs.log.push({ text: `Gained ${xpReward} XP and ${crystalReward} crystals!`, cls: "log-info" });
  for (const msg of levelMsgs) {
    cs.log.push({ text: msg, cls: "log-critical" });
  }

  // Drop a rune from bosses
  if (e.isBoss) {
    const allRunes = Object.keys(content.spells.runes);
    const unowned = allRunes.filter(r => !p.runes.includes(r));
    if (unowned.length > 0) {
      const rune = unowned[Math.floor(Math.random() * unowned.length)];
      p.runes.push(rune);
      const runeData = content.spells.runes[rune];
      cs.log.push({ text: `The boss dropped a ${runeData.name} Rune!`, cls: "log-critical" });
    }
  }

  // Mark room as cleared
  state.clearedRooms.add(state.currentRoomId);
  cs.done = true;
  cs.won = true;
  saveGame(state);
  render();
}

// ===== DIALOGUE =====
function enterDialogue(room: RoomData): void {
  dialogueState = { npcId: room.npcId!, responseText: null };
  currentView = "dialogue";
  render();
}

function renderDialogue(): void {
  if (!dialogueState) return;
  const npc = content.dialogue.npcs[dialogueState.npcId];
  if (!npc) {
    currentView = "room";
    render();
    return;
  }

  const container = h("div", { style: "display:flex;flex-direction:column;height:100vh" },
    renderHud(),
    h("div", { className: "dialogue-view" },
      h("div", { className: "dialogue-npc" },
        icon(npc.portrait, "npc-portrait"),
        h("div", {},
          h("div", { className: "npc-name" }, npc.name),
        ),
      ),
      h("div", { className: "dialogue-text" },
        dialogueState.responseText || npc.greeting
      ),
      dialogueState.responseText
        ? h("div", { className: "dialogue-options" },
            h("button", {
              className: "dialogue-option",
              onClick: () => { dialogueState = null; currentView = "room"; render(); },
            }, "Continue"),
          )
        : renderDialogueOptions(npc),
    ),
  );
  root.appendChild(container);
}

function renderDialogueOptions(npc: any): HTMLElement {
  const container = h("div", { className: "dialogue-options" });

  for (const opt of npc.options) {
    const canAfford = state.player.crystals >= (opt.cost || 0);
    const btn = h("button", {
      className: "dialogue-option",
      disabled: !canAfford && opt.cost > 0,
      onClick: () => selectDialogueOption(opt),
    },
      opt.text,
      opt.cost > 0
        ? h("span", { className: "cost-tag" }, `(${opt.cost} crystals)`)
        : null,
    );
    container.appendChild(btn);
  }

  return container;
}

function selectDialogueOption(opt: any): void {
  if (!dialogueState) return;
  const p = state.player;

  // Deduct cost
  if (opt.cost > 0) {
    p.crystals -= opt.cost;
  }

  // Apply reward
  if (opt.reward) {
    if (opt.reward.item) {
      addItem(p, opt.reward.item);
    }
    if (opt.reward.rune) {
      if (!p.runes.includes(opt.reward.rune)) {
        p.runes.push(opt.reward.rune);
      }
    }
  }

  dialogueState.responseText = opt.response;
  saveGame(state);
  render();
}

function addItem(player: PlayerState, itemId: string): void {
  const existing = player.inventory.find(i => i.id === itemId);
  if (existing) {
    existing.quantity++;
  } else {
    const itemData = content.items.items[itemId];
    if (itemData) {
      player.inventory.push({
        id: itemId,
        name: itemData.name,
        description: itemData.description,
        type: itemData.type,
        effect: itemData.effect,
        icon: itemData.icon,
        quantity: 1,
      });
    }
  }
}

// ===== FORGE =====
function enterForge(): void {
  forgeState = { selectedRunes: [], result: null };
  currentView = "forge";
  render();
}

function renderForge(): void {
  const p = state.player;

  const container = h("div", { style: "display:flex;flex-direction:column;height:100vh" },
    renderHud(),
    h("div", { className: "forge-view" },
      h("div", { className: "forge-title" }, "Rune Forge"),
      h("div", { style: "color:#aaa;margin-bottom:12px" }, "Select two runes to combine into a new spell."),

      // Available runes
      h("div", { className: "stat-group-title" }, "Your Runes"),
      renderRuneGrid(),

      // Selected slots
      h("div", { className: "forge-slots" },
        renderForgeSlot(0),
        h("span", { className: "forge-plus" }, "+"),
        renderForgeSlot(1),
        h("span", { className: "forge-plus" }, "="),
        h("span", { style: "color:#aa66ff;font-weight:600" },
          forgeState.result ? forgeState.result.name : "???"),
      ),

      // Result preview
      forgeState.result ? renderForgeResult() : null,

      // Craft button
      h("div", { style: "display:flex;gap:8px;margin-top:12px" },
        h("button", {
          className: "action-btn spells",
          disabled: !forgeState.result || p.spells.length >= p.spellSlots,
          onClick: () => craftSpell(),
        }, "Craft Spell"),
        h("button", {
          className: "action-btn spells",
          disabled: !hasTrainableRune(),
          onClick: () => trainAffinity(),
        }, "Train Affinity (5 crystals)"),
        h("button", {
          className: "nav-btn",
          onClick: () => { currentView = "room"; render(); },
        }, "Leave Forge"),
      ),

      // Current spells
      h("div", { className: "stat-group-title", style: "margin-top:16px" },
        `Equipped Spells (${p.spells.length}/${p.spellSlots})`
      ),
      renderEquippedSpells(),
    ),
  );
  root.appendChild(container);
}

function renderRuneGrid(): HTMLElement {
  const grid = h("div", { className: "rune-grid" });

  for (const runeId of state.player.runes) {
    const runeData = content.spells.runes[runeId];
    if (!runeData) continue;
    const selected = forgeState.selectedRunes.includes(runeId);
    // Count how many times this rune is selected
    const selectedCount = forgeState.selectedRunes.filter(r => r === runeId).length;
    // A rune can be selected multiple times (same + same combos are valid)

    const slot = h("div", {
      className: `rune-slot ${selected ? "selected" : ""}`,
      style: `border-color:${selected ? runeData.color : ""}`,
      onClick: () => toggleRune(runeId),
    },
      icon(runeData.element, "rune-icon"),
    );

    const wrapper = h("div", { style: "text-align:center" },
      slot,
      h("div", { className: "rune-name", style: `color:${runeData.color}` }, runeData.name),
    );
    grid.appendChild(wrapper);
  }

  return grid;
}

function toggleRune(runeId: string): void {
  const idx = forgeState.selectedRunes.indexOf(runeId);
  if (idx >= 0) {
    forgeState.selectedRunes.splice(idx, 1);
  } else if (forgeState.selectedRunes.length < 2) {
    forgeState.selectedRunes.push(runeId);
  }

  // Check recipe
  if (forgeState.selectedRunes.length === 2) {
    forgeState.result = findRecipe(forgeState.selectedRunes);
  } else {
    forgeState.result = null;
  }

  render();
}

function findRecipe(runes: string[]): Spell | null {
  const sorted = [...runes].sort();
  for (const recipe of content.spells.recipes) {
    const recipeSorted = [...recipe.runes].sort();
    if (sorted[0] === recipeSorted[0] && sorted[1] === recipeSorted[1]) {
      // Check affinity for enhanced version
      const spell = { ...recipe.result };
      const totalAffinity = runes.reduce((sum: number, r: string) => sum + (state.player.runeAffinity[r] || 0), 0);
      if (totalAffinity >= 5) {
        spell.damage = Math.round(spell.damage * 1.3);
        spell.name = `Enhanced ${spell.name}`;
        spell.description = `[Enhanced] ${spell.description}`;
      }
      return spell as Spell;
    }
  }
  return null;
}

function renderForgeSlot(index: number): HTMLElement {
  const runeId = forgeState.selectedRunes[index];
  if (runeId) {
    const runeData = content.spells.runes[runeId];
    return h("div", { className: "forge-slot filled", style: `border-color:${runeData?.color}44` },
      icon(runeData?.element || "spell", "rune-icon"),
    );
  }
  return h("div", { className: "forge-slot" },
    h("span", { style: "color:#444" }, "?"),
  );
}

function renderForgeResult(): HTMLElement {
  const spell = forgeState.result!;
  return h("div", { className: "forge-result" },
    h("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px" },
      icon(spell.element || "spell", "spell-icon"),
      h("span", { style: "font-weight:600;color:#aa66ff" }, spell.name),
      h("span", { className: "spell-cost" }, `${spell.manaCost} MP`),
    ),
    h("div", { style: "color:#aaa;font-size:0.85rem" }, spell.description),
    spell.damage > 0 ? h("div", { style: "color:#ff6644;font-size:0.8rem;margin-top:4px" }, `Damage: ${spell.damage}`) : null,
    spell.dotDamage ? h("div", { style: "color:#ff8844;font-size:0.8rem" }, `DoT: ${spell.dotDamage}/turn for ${spell.dotTurns} turns`) : null,
  );
}

function craftSpell(): void {
  if (!forgeState.result) return;
  const p = state.player;

  if (p.spells.length >= p.spellSlots) {
    return; // No room
  }

  // Add the crafted spell
  const spell = { ...forgeState.result, runes: [...forgeState.selectedRunes] };
  p.spells.push(spell);

  // Increase affinity
  for (const runeId of forgeState.selectedRunes) {
    p.runeAffinity[runeId] = (p.runeAffinity[runeId] || 0) + 1;
  }

  // Reset forge
  forgeState = { selectedRunes: [], result: null };
  saveGame(state);
  render();
}

function hasTrainableRune(): boolean {
  return state.player.runes.length > 0 && state.player.crystals >= 5;
}

function trainAffinity(): void {
  const p = state.player;
  if (p.crystals < 5) return;

  p.crystals -= 5;
  // Train all owned runes a bit
  for (const runeId of p.runes) {
    p.runeAffinity[runeId] = (p.runeAffinity[runeId] || 0) + 0.5;
  }

  saveGame(state);
  render();
}

function renderEquippedSpells(): HTMLElement {
  const list = h("div", { className: "spell-list" });
  for (let i = 0; i < state.player.spells.length; i++) {
    const spell = state.player.spells[i];
    list.appendChild(
      h("div", { className: "spell-item" },
        icon(spell.element || "spell", "spell-icon"),
        h("div", { style: "flex:1" },
          h("div", { className: "spell-name" }, spell.name),
          h("div", { className: "spell-desc" }, spell.description),
        ),
        h("span", { className: "spell-cost" }, `${spell.manaCost} MP`),
        h("button", {
          className: "nav-btn",
          style: "padding:4px 8px;font-size:0.7rem",
          onClick: () => {
            state.player.spells.splice(i, 1);
            saveGame(state);
            render();
          },
        }, "Remove"),
      )
    );
  }
  return list;
}

// ===== TREASURE =====
function openTreasure(room: RoomData): void {
  if (!room.loot) return;

  if (room.loot.crystals) {
    state.player.crystals += room.loot.crystals;
  }
  if (room.loot.item) {
    addItem(state.player, room.loot.item);
  }

  state.clearedRooms.add(room.id);
  currentView = "treasure";
  saveGame(state);
  render();
}

function renderTreasure(): void {
  const room = getCurrentRoom(state, content);
  const container = h("div", { style: "display:flex;flex-direction:column;height:100vh" },
    renderHud(),
    h("div", { className: "treasure-view" },
      icon("treasure", "treasure-icon"),
      h("h2", { style: "font-family:'Cinzel',serif;color:#ffdd44;margin-bottom:12px" }, "Treasure Found!"),
      room.loot?.crystals
        ? h("div", { style: "color:#44ddff;font-size:1.1rem;margin-bottom:8px" }, `+${room.loot.crystals} Mana Crystals`)
        : null,
      room.loot?.item
        ? h("div", { style: "color:#66ff99;font-size:1.1rem;margin-bottom:16px" }, `+1 ${content.items.items[room.loot.item]?.name || room.loot.item}`)
        : null,
      h("button", {
        className: "title-btn",
        onClick: () => { currentView = "room"; render(); },
      }, "Continue"),
    ),
  );
  root.appendChild(container);
}

// ===== REST =====
function enterRest(): void {
  const p = state.player;
  // Limited heal - not full restore (G4: resource pressure)
  const hpRestore = Math.floor(p.combatStats.maxHp * 0.4);
  const manaRestore = Math.floor(p.combatStats.maxMana * 0.3);

  p.combatStats.currentHp = Math.min(p.combatStats.maxHp, p.combatStats.currentHp + hpRestore);
  p.combatStats.currentMana = Math.min(p.combatStats.maxMana, p.combatStats.currentMana + manaRestore);
  p.statusEffects = [];

  currentView = "rest";
  saveGame(state);
  render();
}

function renderRest(): void {
  const container = h("div", { style: "display:flex;flex-direction:column;height:100vh" },
    renderHud(),
    h("div", { className: "rest-view" },
      icon("rest", "rest-icon"),
      h("h2", { style: "font-family:'Cinzel',serif;color:#66ff99;margin-bottom:12px" }, "You Rest..."),
      h("div", { style: "color:#88ccaa;margin-bottom:8px" }, "Recovered 40% HP and 30% Mana."),
      h("div", { style: "color:#888;font-size:0.85rem;margin-bottom:16px" }, "Status effects cleared."),
      h("button", {
        className: "title-btn",
        onClick: () => { currentView = "room"; render(); },
      }, "Continue"),
    ),
  );
  root.appendChild(container);
}

// ===== GAME OVER =====
function renderGameOver(): void {
  const container = h("div", { className: "game-over-screen" },
    h("h1", { style: "font-family:'Cinzel',serif;font-size:3rem;color:#cc2222;margin-bottom:12px" }, "Defeat"),
    h("div", { style: "color:#886666;margin-bottom:24px" }, "The dungeon claims another soul..."),
    h("div", { style: "color:#aaa;margin-bottom:8px" }, `Floor: ${state.currentFloorIndex + 1} | Level: ${state.player.level} | Kills: ${state.player.killCount}`),
    h("button", {
      className: "title-btn",
      onClick: () => {
        localStorage.removeItem("escape-dungeon-save");
        currentView = "title";
        render();
      },
    }, "Return to Title"),
  );
  root.appendChild(container);
}

// ===== VICTORY =====
function renderVictory(): void {
  const container = h("div", { className: "game-over-screen victory-screen" },
    h("h1", { style: "font-family:'Cinzel',serif;font-size:3rem;color:#66ff99;margin-bottom:12px" }, "Escaped!"),
    h("div", { style: "color:#88ccaa;margin-bottom:24px" }, "You have escaped the dungeon!"),
    h("div", { style: "color:#aaa;margin-bottom:8px" }, `Level: ${state.player.level} | Kills: ${state.player.killCount} | Spells Crafted: ${state.player.spells.length}`),
    h("button", {
      className: "title-btn",
      onClick: () => {
        localStorage.removeItem("escape-dungeon-save");
        currentView = "title";
        render();
      },
    }, "Return to Title"),
  );
  root.appendChild(container);
}

// ===== HELPERS =====
function featureLabel(feature: string): string {
  const labels: Record<string, string> = {
    combat: "Combat",
    dialogue: "Event",
    treasure: "Treasure",
    rest: "Rest",
    rune_forge: "Forge",
    boss: "Boss",
    start: "Entrance",
    escape_gate: "Exit",
  };
  return labels[feature] || feature;
}

function dirLabel(dir: string): string {
  const labels: Record<string, string> = {
    north: "North",
    south: "South",
    east: "East",
    west: "West",
    up: "Up",
    down: "Down",
  };
  return labels[dir] || dir;
}
