import type { GameState } from "./state";
import type { Player, Room, RoomType, EnemyInstance, Spell } from "./types";
import {
  currentRoom,
  currentFloor,
  findSpell,
  getRoom,
  previewForge,
  instantiateEnemies,
  saveState,
  clearSave,
  loadState,
  createInitialState,
} from "./state";
import { RUNES, SPELLS, SKILLS, EVENTS } from "./content";
import {
  playerUseSpell,
  playerUseSkill,
  playerTryFlee,
  enemyTurn,
  checkCombatResult,
  applyRewards,
} from "./combat";

const ROOM_ICON: Record<RoomType, string> = {
  start: "game-icons:dungeon-gate",
  combat: "game-icons:crossed-swords",
  elite: "game-icons:sword-wound",
  forge: "game-icons:anvil",
  rest: "game-icons:campfire",
  event: "game-icons:scroll-unfurled",
  boss: "game-icons:evil-wings",
};

const ROOM_LABEL: Record<RoomType, string> = {
  start: "Entrance",
  combat: "Combat",
  elite: "Elite",
  forge: "Forge",
  rest: "Rest",
  event: "Event",
  boss: "Boss",
};

export type App = {
  state: GameState;
  root: HTMLElement;
  overlay: "none" | "map" | "traits" | "spellbook" | "bag";
  render: () => void;
};

function icon(name: string, size = 20): string {
  return `<iconify-icon icon="${name}" style="font-size:${size}px"></iconify-icon>`;
}

function bar(label: string, cur: number, max: number, cls: string): string {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  return `
    <div class="bar-row">
      <div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%"></div><div class="bar-label">${label} ${Math.max(0, Math.round(cur))}/${max}</div></div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// ============ HUD ============

function renderHud(app: App): string {
  const p = app.state.player;
  const floor = currentFloor(app.state);
  return `
    <div class="hud">
      <div class="hud-left">
        <div class="hud-name">${icon("game-icons:hooded-figure", 22)} ${escapeHtml(p.name)} <span class="muted small">Lv ${p.level}</span></div>
        ${bar("HP", p.combatStats.currentHp, p.combatStats.maxHp, "hp")}
        ${bar("MP", p.combatStats.currentMana, p.combatStats.maxMana, "mp")}
        <div class="hud-stat">${icon("game-icons:crystal-cluster", 18)} <strong>${p.crystals}</strong></div>
        <div class="hud-stat">${icon("game-icons:stairs-goal", 18)} <strong>${floor.name}</strong></div>
        <div class="hud-stat">${icon("game-icons:hourglass", 18)} Tick <strong>${p.tick}</strong></div>
      </div>
      <div class="toolbar">
        <button data-action="overlay:map" title="Map">${icon("game-icons:treasure-map", 18)}</button>
        <button data-action="overlay:spellbook" title="Spellbook">${icon("game-icons:spell-book", 18)}</button>
        <button data-action="overlay:traits" title="Traits">${icon("game-icons:character", 18)}</button>
        <button data-action="overlay:bag" title="Bag">${icon("game-icons:knapsack", 18)}</button>
        <button data-action="save" title="Save">${icon("game-icons:save-arrow", 18)}</button>
      </div>
    </div>
  `;
}

// ============ TITLE ============

function renderTitle(app: App): string {
  return `
    <div class="title-screen">
      <div class="title-art">${icon("game-icons:dungeon-gate", 180)}</div>
      <h1>Escape the Dungeon</h1>
      <div class="title-tagline">Your starting spell is not enough. The Sovereign laughs at fire. Forge what you must to survive.</div>
      <div class="title-menu">
        <button class="primary" data-action="new-game">${icon("game-icons:flaming-sheet", 22)} New Game</button>
        <button data-action="continue">${icon("game-icons:save-arrow", 22)} Continue</button>
        <button data-action="about">${icon("game-icons:help", 22)} About</button>
      </div>
    </div>
  `;
}

// ============ ROOM ============

function renderRoom(app: App): string {
  const room = currentRoom(app.state);
  const p = app.state.player;
  const featureCls = `room-${room.feature}`;

  let content = "";

  if (room.feature === "rest") {
    content = renderRest(app, room);
  } else if (room.feature === "forge") {
    content = renderForge(app, room);
  } else if (room.feature === "event") {
    content = renderEvent(app, room);
  } else {
    content = renderRoomDefault(app, room);
  }

  return `
    ${renderHud(app)}
    <div class="panel ${featureCls}">
      <div class="panel-header">
        ${icon(room.icon || ROOM_ICON[room.feature], 28)}
        <h2>${escapeHtml(room.name)}</h2>
        <div class="sub">${ROOM_LABEL[room.feature]} · ${escapeHtml(currentFloor(app.state).name)}</div>
      </div>
      ${content}
    </div>
  `;
}

function renderRoomDefault(app: App, room: Room): string {
  const cleared = app.state.player.clearedRoomIds.includes(room.id);
  const hasEnemies = (room.feature === "combat" || room.feature === "elite" || room.feature === "boss") && !!room.enemyIds && room.enemyIds.length > 0;
  const canEnterCombat = hasEnemies && (!cleared || room.respawn === true || room.feature === "boss" && !app.state.player.defeatedBossIds.includes(room.id));

  return `
    <div class="room-view">
      <div>
        <div class="room-art">${icon(room.icon || ROOM_ICON[room.feature], 130)}</div>
        <div class="room-description">${escapeHtml(room.description)}</div>
        ${canEnterCombat ? `
          <button class="primary" data-action="start-combat">
            ${icon("game-icons:crossed-swords", 20)} ${room.feature === "boss" ? "Fight the Boss" : room.feature === "elite" ? "Challenge the Elite" : "Engage Enemies"}
          </button>
        ` : cleared ? `<div class="banner info">Cleared.</div>` : ""}
      </div>
      <div class="exits">
        <h3>Exits</h3>
        ${room.exits.map(e => {
          const to = getRoom(app.state, e.to);
          if (!to) return "";
          const label = e.label ?? to.name;
          const typeLabel = ROOM_LABEL[to.feature];
          return `
            <button class="exit-btn" data-action="move:${to.id}">
              ${icon(ROOM_ICON[to.feature], 22)}
              <span>${escapeHtml(label)}</span>
              <span class="room-type-label">${typeLabel}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

// ============ REST ============

function renderRest(app: App, room: Room): string {
  const p = app.state.player;
  const healCapHp = Math.round(p.combatStats.maxHp * 0.85);
  const healCapMp = Math.round(p.combatStats.maxMana * 0.85);
  return `
    <div class="rest-view">
      <div>${icon("game-icons:campfire", 120)}</div>
      <div class="room-description">${escapeHtml(room.description)}</div>
      <div class="muted">You can rest once — it will restore HP to ${healCapHp} and MP to ${healCapMp} (capped, not full).</div>
      <div style="margin-top: 16px;">
        <button class="success" data-action="rest-heal">${icon("game-icons:health-normal", 20)} Rest</button>
      </div>
    </div>
    <div class="exits" style="margin-top: 20px;">
      <h3>Exits</h3>
      ${room.exits.map(e => {
        const to = getRoom(app.state, e.to);
        if (!to) return "";
        return `<button class="exit-btn" data-action="move:${to.id}">${icon(ROOM_ICON[to.feature], 22)}<span>${escapeHtml(e.label ?? to.name)}</span><span class="room-type-label">${ROOM_LABEL[to.feature]}</span></button>`;
      }).join("")}
    </div>
  `;
}

// ============ FORGE ============

function renderForge(app: App, room: Room): string {
  const sel = app.state.forgeSelection;
  const preview = previewForge(sel);
  const p = app.state.player;

  const slots = Array.from({ length: 2 }).map((_, i) => {
    const rid = sel[i];
    if (!rid) return `<div class="forge-slot">+</div>`;
    const r = RUNES.find(r => r.id === rid)!;
    return `<div class="forge-slot filled ${r.color}">${icon(r.icon, 36)}</div>`;
  }).join(`<div style="font-size: 28px; color: var(--text-dim)">+</div>`);

  const knownIds = new Set(p.knownSpellIds);
  const knownList = p.knownSpellIds.map(id => {
    const s = findSpell(id)!;
    const prepared = p.preparedSpellIds.includes(id);
    return `
      <div class="submenu-row">
        <span class="name">${icon(s.icon, 20)} ${escapeHtml(s.name)}</span>
        <span class="cost">${s.manaCost} MP${s.crystalCost ? ` · ${s.crystalCost}◆` : ""}</span>
        <button class="${prepared ? "success" : ""}" data-action="toggle-prep:${id}">${prepared ? "Prepared" : "Prepare"}</button>
      </div>
    `;
  }).join("");

  return `
    <div class="forge">
      <div>
        <h3>Runes</h3>
        <div class="rune-grid">
          ${RUNES.map(r => {
            const selIdx = sel.indexOf(r.id);
            const count = sel.filter(x => x === r.id).length;
            const selCls = count > 0 ? "selected" : "";
            const aff = p.runeAffinity[r.id] ?? 0;
            return `
              <div class="rune-tile ${selCls} ${r.color}" data-action="rune:${r.id}">
                ${icon(r.icon, 36)}
                <div class="rune-name">${r.name}</div>
                <div class="rune-affinity">Affinity ${aff}</div>
              </div>
            `;
          }).join("")}
        </div>
        <h3>Forge Slots (choose 1-2 runes)</h3>
        <div class="forge-slots">${slots}</div>
        <div class="row">
          <button data-action="forge-clear">${icon("game-icons:cancel", 18)} Clear</button>
          <div class="sp"></div>
          <button class="primary" data-action="forge-craft" ${preview ? "" : "disabled"}>
            ${icon("game-icons:anvil", 18)} Craft
          </button>
        </div>
      </div>
      <div>
        <h3>Preview</h3>
        <div class="forge-preview">
          ${preview ? `
            <h3>${icon(preview.icon, 22)} ${escapeHtml(preview.name)}</h3>
            <div class="small muted">${escapeHtml(preview.description)}</div>
            <div class="small" style="margin-top:6px;">Cost: ${preview.manaCost} MP${preview.crystalCost ? ` · ${preview.crystalCost}◆` : ""}</div>
            <div class="small">Type: <span class="gold">${preview.damageType}</span></div>
            ${knownIds.has(preview.id) ? `<div class="small" style="color: var(--green); margin-top: 6px;">Already known</div>` : ""}
          ` : sel.length === 0 ? `<div class="muted">Select runes to preview a spell.</div>` : `<div class="muted">No valid combination. Try different runes.</div>`}
        </div>

        <h3 style="margin-top: 20px;">Spellbook</h3>
        <div class="submenu" style="display:block; padding: 0; background: none; border: none;">
          ${knownList}
        </div>

        <h3 style="margin-top: 20px;">Train Affinity (1 crystal → +2 to selected rune)</h3>
        <div class="row">
          ${RUNES.map(r => `<button data-action="train:${r.id}" ${p.crystals < 1 ? "disabled" : ""}>${icon(r.icon, 16)}${r.letter}</button>`).join("")}
        </div>
      </div>
    </div>
    <div class="exits" style="margin-top: 20px;">
      <h3>Exits</h3>
      ${room.exits.map(e => {
        const to = getRoom(app.state, e.to);
        if (!to) return "";
        return `<button class="exit-btn" data-action="move:${to.id}">${icon(ROOM_ICON[to.feature], 22)}<span>${escapeHtml(e.label ?? to.name)}</span><span class="room-type-label">${ROOM_LABEL[to.feature]}</span></button>`;
      }).join("")}
    </div>
  `;
}

// ============ EVENT ============

function renderEvent(app: App, room: Room): string {
  const ev = EVENTS.find(e => e.id === room.eventId);
  if (!ev) {
    return `<div class="muted">Nothing of note.</div>`;
  }
  const resolved = app.state.player.clearedRoomIds.includes(room.id);
  return `
    <div class="event-view">
      <div class="event-text">${escapeHtml(ev.text)}</div>
      ${resolved ? `<div class="banner info">You've already resolved this.</div>` : `
        <div class="event-choices">
          ${ev.choices.map((c, i) => `<button data-action="event-choice:${i}">${icon("game-icons:scroll-unfurled", 18)} ${escapeHtml(c.label)}</button>`).join("")}
        </div>
      `}
    </div>
    <div class="exits" style="margin-top: 20px;">
      <h3>Exits</h3>
      ${room.exits.map(e => {
        const to = getRoom(app.state, e.to);
        if (!to) return "";
        return `<button class="exit-btn" data-action="move:${to.id}">${icon(ROOM_ICON[to.feature], 22)}<span>${escapeHtml(e.label ?? to.name)}</span><span class="room-type-label">${ROOM_LABEL[to.feature]}</span></button>`;
      }).join("")}
    </div>
  `;
}

// ============ COMBAT ============

function renderCombat(app: App): string {
  if (app.state.scene.kind !== "combat") return "";
  const sc = app.state.scene;
  const p = app.state.player;
  const enemies = sc.enemies;

  const enemyBlocks = enemies.map((e, i) => renderCombatant(e, i, "enemy")).join("");

  const submenu = renderCombatSubmenu(app);

  return `
    ${renderHud(app)}
    <div class="panel">
      <div class="panel-header">
        ${icon("game-icons:crossed-swords", 26)}
        <h2>Combat</h2>
        <div class="sub">${sc.isBoss ? "BOSS" : "Encounter"}</div>
      </div>
      <div class="combat">
        ${enemyBlocks}
        <div class="combatant player">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="combatant-portrait">${icon("game-icons:hooded-figure", 96)}</div>
          <div class="combatant-stats">
            ${bar("HP", p.combatStats.currentHp, p.combatStats.maxHp, "hp")}
            ${bar("MP", p.combatStats.currentMana, p.combatStats.maxMana, "mp")}
            <div class="small muted">◆ ${p.crystals} crystals</div>
            ${p.activeEffects.length ? `<div class="resistance-tags">${p.activeEffects.map(e => `<span class="tag"><iconify-icon icon="game-icons:aura" style="font-size:12px"></iconify-icon>${e.kind} ${e.turns}</span>`).join("")}</div>` : ""}
          </div>
        </div>
        <div class="combat-log">
          ${app.state.combatLog.slice(-8).map(l => l).join("")}
        </div>
        <div class="combat-actions">
          <button class="action-btn" data-action="combat-action:skill">${icon("game-icons:broadsword", 28)}Fight</button>
          <button class="action-btn" data-action="combat-action:spell">${icon("game-icons:magic-swirl", 28)}Spells</button>
          <button class="action-btn" data-action="combat-action:bag">${icon("game-icons:knapsack", 28)}Bag</button>
          <button class="action-btn" data-action="combat-action:run">${icon("game-icons:run", 28)}Run</button>
        </div>
        ${submenu}
      </div>
    </div>
  `;
}

function renderCombatant(e: EnemyInstance, i: number, cls: string): string {
  const tags: string[] = [];
  const res = e.resistances as Record<string, number | undefined>;
  for (const k of Object.keys(res)) {
    const v = res[k];
    if (v === undefined) continue;
    if (v === 0) tags.push(`<span class="tag immune">immune ${k}</span>`);
    else if (v <= 0.5) tags.push(`<span class="tag resist">resist ${k}</span>`);
    else if (v >= 1.4) tags.push(`<span class="tag weak">weak ${k}</span>`);
  }
  const effects = e.activeEffects.map(ef => `<span class="tag">${ef.kind} ${ef.turns}</span>`).join("");
  const dead = e.combatStats.currentHp <= 0;
  return `
    <div class="combatant ${cls}" style="${dead ? "opacity:0.35; filter: grayscale(1);" : ""}">
      <h3>${escapeHtml(e.name)}</h3>
      <div class="combatant-portrait">${icon(e.icon, 96)}</div>
      <div class="combatant-stats">
        ${bar("HP", e.combatStats.currentHp, e.combatStats.maxHp, "hp")}
        ${e.notes ? `<div class="small muted">${escapeHtml(e.notes)}</div>` : ""}
        <div class="resistance-tags">${tags.join("")}${effects}</div>
      </div>
    </div>
  `;
}

function renderCombatSubmenu(app: App): string {
  if (!app.state.selectedAction) return "";
  const p = app.state.player;
  if (app.state.selectedAction === "spell") {
    return `
      <div class="submenu">
        <div class="small muted">Choose a spell:</div>
        ${p.preparedSpellIds.map(id => {
          const s = findSpell(id)!;
          const disabled = p.combatStats.currentMana < s.manaCost || (s.crystalCost ? p.crystals < s.crystalCost : false);
          return `
            <div class="submenu-row ${disabled ? "disabled" : ""}" data-action="${disabled ? "noop" : `cast:${id}`}">
              <span class="name">${icon(s.icon, 20)} ${escapeHtml(s.name)}</span>
              <span class="cost">${s.manaCost} MP${s.crystalCost ? ` · ${s.crystalCost}◆` : ""}</span>
              <div class="desc">${escapeHtml(s.description)}</div>
            </div>
          `;
        }).join("")}
        <button data-action="combat-cancel">${icon("game-icons:cancel", 16)} Back</button>
      </div>
    `;
  }
  if (app.state.selectedAction === "skill") {
    return `
      <div class="submenu">
        <div class="small muted">Choose a skill:</div>
        ${SKILLS.filter(s => p.skillIds.includes(s.id)).map(s => `
          <div class="submenu-row" data-action="skill:${s.id}:0">
            <span class="name">${icon(s.icon, 20)} ${escapeHtml(s.name)}</span>
            <span class="cost">${s.manaCost > 0 ? s.manaCost + " MP" : "—"}</span>
            <div class="desc">${escapeHtml(s.description)}</div>
          </div>
          ${s.crystalOvercharge ? `
            <div class="submenu-row ${p.crystals < s.crystalOvercharge.crystalCost ? "disabled" : ""}" data-action="${p.crystals < s.crystalOvercharge.crystalCost ? "noop" : `skill:${s.id}:1`}">
              <span class="name">${icon("game-icons:crystal-cluster", 20)} ${escapeHtml(s.name)} (overcharged)</span>
              <span class="cost">${s.crystalOvercharge.crystalCost}◆</span>
              <div class="desc">+${s.crystalOvercharge.bonus} damage + bleed DoT</div>
            </div>
          ` : ""}
        `).join("")}
        <button data-action="combat-cancel">${icon("game-icons:cancel", 16)} Back</button>
      </div>
    `;
  }
  return "";
}

// ============ OVERLAYS ============

function renderOverlay(app: App): string {
  if (app.overlay === "none") return "";
  const p = app.state.player;
  let body = "";
  let title = "";
  if (app.overlay === "map") {
    title = "Map";
    const f = currentFloor(app.state);
    body = `
      <div class="muted small" style="margin-bottom: 10px;">${escapeHtml(f.description)}</div>
      <div class="small" style="margin-bottom: 10px;">Mechanical pressure: <span class="gold">${escapeHtml(f.mechanicalConstraint)}</span></div>
      <div class="map-grid">
        ${f.rooms.map(r => {
          const isCurrent = r.id === p.currentRoomId;
          const discovered = p.discoveredRoomIds.includes(r.id);
          const cleared = p.clearedRoomIds.includes(r.id);
          const cls = isCurrent ? "current" : cleared ? "cleared" : discovered ? "" : "undiscovered";
          return `
            <div class="map-room ${cls}">
              ${icon(ROOM_ICON[r.feature], 28)}
              <div>${discovered ? escapeHtml(r.name) : "???"}</div>
              <div class="muted" style="font-size: 10px;">${ROOM_LABEL[r.feature]}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (app.overlay === "traits") {
    title = "Traits";
    body = `
      <div class="small muted" style="margin-bottom: 10px;">Narrative traits — shaped by your choices.</div>
      <div class="traits-list">
        ${Object.entries(p.narrativeStats).map(([k, v]) => `<div class="trait"><span>${escapeHtml(k)}</span><span class="v">${v}</span></div>`).join("")}
      </div>
    `;
  } else if (app.overlay === "spellbook") {
    title = "Spellbook";
    body = `
      <div class="small muted" style="margin-bottom: 10px;">Prepared spells travel into combat. Visit a forge to change them.</div>
      <div class="spell-list">
        ${p.knownSpellIds.map(id => {
          const s = findSpell(id)!;
          const prepared = p.preparedSpellIds.includes(id);
          return `
            <div class="submenu-row">
              <span class="name">${icon(s.icon, 20)} ${escapeHtml(s.name)}</span>
              <span class="cost">${s.manaCost} MP${s.crystalCost ? ` · ${s.crystalCost}◆` : ""}</span>
              ${prepared ? `<span class="tag weak">prepared</span>` : ""}
            </div>
            <div class="small muted" style="padding: 0 12px 6px;">${escapeHtml(s.description)}</div>
          `;
        }).join("")}
      </div>
    `;
  } else if (app.overlay === "bag") {
    title = "Bag";
    body = `
      <div class="small">${icon("game-icons:crystal-cluster", 18)} Mana crystals: <strong>${p.crystals}</strong></div>
      <div class="small muted" style="margin-top: 10px;">No consumables in this build. Crystals power forge training and overcharged skills.</div>
    `;
  }
  return `
    <div class="overlay" data-action="overlay-close">
      <div class="overlay-panel" onclick="event.stopPropagation()">
        <div class="overlay-header">
          ${icon("game-icons:book-cover", 24)}
          <h2>${title}</h2>
          <button data-action="overlay-close">${icon("game-icons:cancel", 16)} Close</button>
        </div>
        ${body}
      </div>
    </div>
  `;
}

// ============ GAMEOVER / VICTORY ============

function renderGameover(app: App): string {
  if (app.state.scene.kind !== "gameover") return "";
  return `
    <div class="title-screen">
      <div class="title-art" style="color: var(--red)">${icon("game-icons:tombstone", 160)}</div>
      <h1 style="color: var(--red);">You Fell</h1>
      <div class="title-tagline">${escapeHtml(app.state.scene.reason)}</div>
      <div class="title-menu">
        <button class="primary" data-action="new-game">${icon("game-icons:flaming-sheet", 20)} Try Again</button>
      </div>
    </div>
  `;
}

function renderVictory(_app: App): string {
  return `
    <div class="title-screen">
      <div class="title-art gold">${icon("game-icons:laurel-crown", 160)}</div>
      <h1>Escape!</h1>
      <div class="title-tagline">You have climbed out of the dungeon. The sun is blinding.</div>
      <div class="title-menu">
        <button class="primary" data-action="new-game">${icon("game-icons:flaming-sheet", 20)} Play Again</button>
      </div>
    </div>
  `;
}

// ============ ROOT RENDER ============

export function renderApp(app: App): void {
  const sc = app.state.scene;
  let main = "";
  if (sc.kind === "title") main = renderTitle(app);
  else if (sc.kind === "room") main = renderRoom(app);
  else if (sc.kind === "combat") main = renderCombat(app);
  else if (sc.kind === "gameover") main = renderGameover(app);
  else if (sc.kind === "victory") main = renderVictory(app);
  app.root.innerHTML = main + renderOverlay(app);
}

// ============ EVENTS / HANDLERS ============

export function bindEvents(app: App): void {
  app.root.addEventListener("click", (ev) => {
    const target = (ev.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-action")!;
    handleAction(app, action);
  });
}

function pushLog(app: App, line: string, cls = "info"): void {
  app.state.combatLog.push(`<div class="line ${cls}">${line}</div>`);
}

function handleAction(app: App, action: string): void {
  const [cmd, ...rest] = action.split(":");
  const arg = rest.join(":");
  const st = app.state;

  switch (cmd) {
    case "new-game": {
      clearSave();
      app.state = createInitialState();
      app.state.scene = { kind: "room", roomId: app.state.player.currentRoomId };
      saveState(app.state);
      app.render();
      return;
    }
    case "continue": {
      const s = loadState();
      if (s) {
        app.state = s;
      } else {
        app.state = createInitialState();
        app.state.scene = { kind: "room", roomId: app.state.player.currentRoomId };
      }
      app.render();
      return;
    }
    case "about": {
      alert("Escape the Dungeon — craft spells, adapt, and escape.\n\nYour starter Firebolt will not carry you. Enemies resist fire, reflect direct damage, or are flat-out immune. Visit forges to combine runes into crafted spells.\n\nGood luck, Seeker.");
      return;
    }
    case "save": {
      saveState(st);
      return;
    }
    case "move": {
      const roomId = arg;
      const room = getRoom(st, roomId);
      if (!room) return;
      st.player.currentRoomId = roomId;
      st.player.tick += 1;
      if (!st.player.discoveredRoomIds.includes(roomId)) st.player.discoveredRoomIds.push(roomId);
      // discover neighbors
      for (const ex of room.exits) {
        if (!st.player.discoveredRoomIds.includes(ex.to)) st.player.discoveredRoomIds.push(ex.to);
      }
      st.scene = { kind: "room", roomId };
      st.combatLog = [];
      st.selectedAction = null;
      saveState(st);
      app.render();
      return;
    }
    case "start-combat": {
      const room = currentRoom(st);
      if (!room.enemyIds) return;
      const enemies = instantiateEnemies(room.enemyIds);
      st.scene = { kind: "combat", roomId: room.id, enemies, isBoss: room.feature === "boss" };
      st.combatLog = [];
      pushLog(app, `You face <strong>${enemies.map(e => e.name).join(", ")}</strong>.`, "info");
      st.selectedAction = null;
      app.render();
      return;
    }
    case "rest-heal": {
      const capHp = Math.round(st.player.combatStats.maxHp * 0.85);
      const capMp = Math.round(st.player.combatStats.maxMana * 0.85);
      if (st.player.combatStats.currentHp < capHp) st.player.combatStats.currentHp = capHp;
      if (st.player.combatStats.currentMana < capMp) st.player.combatStats.currentMana = capMp;
      saveState(st);
      app.render();
      return;
    }
    case "rune": {
      if (st.forgeSelection.length < 2) st.forgeSelection.push(arg);
      app.render();
      return;
    }
    case "forge-clear": {
      st.forgeSelection = [];
      app.render();
      return;
    }
    case "forge-craft": {
      const p = previewForge(st.forgeSelection);
      if (!p) return;
      if (!st.player.knownSpellIds.includes(p.id)) {
        st.player.knownSpellIds.push(p.id);
      }
      if (!st.player.preparedSpellIds.includes(p.id) && st.player.preparedSpellIds.length < 5) {
        st.player.preparedSpellIds.push(p.id);
      }
      // gain small affinity for used runes
      for (const r of st.forgeSelection) {
        st.player.runeAffinity[r] = (st.player.runeAffinity[r] ?? 0) + 1;
      }
      st.forgeSelection = [];
      saveState(st);
      app.render();
      return;
    }
    case "toggle-prep": {
      const id = arg;
      const prepared = st.player.preparedSpellIds;
      const idx = prepared.indexOf(id);
      if (idx >= 0) {
        prepared.splice(idx, 1);
      } else {
        if (prepared.length < 5) prepared.push(id);
      }
      saveState(st);
      app.render();
      return;
    }
    case "train": {
      if (st.player.crystals < 1) return;
      st.player.crystals -= 1;
      st.player.runeAffinity[arg] = (st.player.runeAffinity[arg] ?? 0) + 2;
      saveState(st);
      app.render();
      return;
    }
    case "event-choice": {
      const room = currentRoom(st);
      const ev = EVENTS.find(e => e.id === room.eventId);
      if (!ev) return;
      const choice = ev.choices[Number(arg)];
      if (!choice) return;
      if (choice.effect) {
        const eff = choice.effect;
        if (eff.hp) st.player.combatStats.currentHp = Math.max(0, Math.min(st.player.combatStats.maxHp, st.player.combatStats.currentHp + eff.hp));
        if (eff.mana) st.player.combatStats.currentMana = Math.max(0, Math.min(st.player.combatStats.maxMana, st.player.combatStats.currentMana + eff.mana));
        if (eff.crystals) st.player.crystals += eff.crystals;
        if (eff.xp) st.player.xp += eff.xp;
        if (eff.trait) {
          st.player.narrativeStats[eff.trait.name] = (st.player.narrativeStats[eff.trait.name] ?? 0) + eff.trait.delta;
        }
      }
      if (!st.player.clearedRoomIds.includes(room.id)) st.player.clearedRoomIds.push(room.id);
      alert(choice.outcome);
      saveState(st);
      app.render();
      return;
    }
    case "combat-action": {
      if (arg === "run") {
        if (st.scene.kind === "combat") {
          const ok = playerTryFlee(st.player, st.scene.enemies, (l, c) => pushLog(app, l, c));
          if (ok) {
            st.scene = { kind: "room", roomId: st.scene.roomId };
            st.selectedAction = null;
          } else {
            enemyTurn(st.player, st.scene.enemies, (l, c) => pushLog(app, l, c));
            checkEnd(app);
          }
          app.render();
          return;
        }
      } else if (arg === "bag") {
        alert("Your bag is empty. (No consumables in this build.)");
        return;
      } else if (arg === "skill") {
        st.selectedAction = "skill";
        app.render();
        return;
      } else if (arg === "spell") {
        st.selectedAction = "spell";
        app.render();
        return;
      }
      return;
    }
    case "combat-cancel": {
      st.selectedAction = null;
      app.render();
      return;
    }
    case "cast": {
      if (st.scene.kind !== "combat") return;
      const spell = findSpell(arg);
      if (!spell) return;
      // target first living enemy
      const idx = st.scene.enemies.findIndex(e => e.combatStats.currentHp > 0);
      if (idx < 0) return;
      playerUseSpell(st.player, st.scene.enemies, idx, arg, (l, c) => pushLog(app, l, c));
      st.selectedAction = null;
      advanceCombat(app);
      return;
    }
    case "skill": {
      if (st.scene.kind !== "combat") return;
      const [skillId, overStr] = arg.split(":");
      const idx = st.scene.enemies.findIndex(e => e.combatStats.currentHp > 0);
      if (idx < 0) return;
      playerUseSkill(st.player, st.scene.enemies, idx, skillId, overStr === "1", (l, c) => pushLog(app, l, c));
      st.selectedAction = null;
      advanceCombat(app);
      return;
    }
    case "overlay": {
      app.overlay = arg as any;
      app.render();
      return;
    }
    case "overlay-close": {
      app.overlay = "none";
      app.render();
      return;
    }
    case "noop": {
      return;
    }
  }
}

function advanceCombat(app: App): void {
  const st = app.state;
  if (st.scene.kind !== "combat") return;
  let result = checkCombatResult(st.player, st.scene.enemies);
  if (result.kind === "victory") {
    finishCombat(app, result.xp, result.crystals);
    return;
  }
  if (result.kind === "defeat") {
    st.scene = { kind: "gameover", reason: "The dungeon swallowed you whole." };
    clearSave();
    app.render();
    return;
  }
  // enemy turn
  enemyTurn(st.player, st.scene.enemies, (l, c) => pushLog(app, l, c));
  result = checkCombatResult(st.player, st.scene.enemies);
  if (result.kind === "defeat") {
    st.scene = { kind: "gameover", reason: "The dungeon swallowed you whole." };
    clearSave();
    app.render();
    return;
  }
  if (result.kind === "victory") {
    finishCombat(app, result.xp, result.crystals);
    return;
  }
  app.render();
}

function checkEnd(app: App): void {
  const st = app.state;
  if (st.scene.kind !== "combat") return;
  const result = checkCombatResult(st.player, st.scene.enemies);
  if (result.kind === "defeat") {
    st.scene = { kind: "gameover", reason: "You did not escape." };
    clearSave();
  }
  if (result.kind === "victory") {
    finishCombat(app, result.xp, result.crystals);
  }
}

function finishCombat(app: App, xp: number, crystals: number): void {
  const st = app.state;
  if (st.scene.kind !== "combat") return;
  applyRewards(st.player, xp, crystals);
  pushLog(app, `Victory. +${xp} XP, +${crystals} crystals.`, "crit");
  const roomId = st.scene.roomId;
  const room = getRoom(st, roomId);
  if (room) {
    if (!st.player.clearedRoomIds.includes(room.id)) st.player.clearedRoomIds.push(room.id);
    if (room.feature === "boss" && !st.player.defeatedBossIds.includes(room.id)) {
      st.player.defeatedBossIds.push(room.id);
      // advance to next floor
      if (st.player.floorIndex + 1 < st.floors.length) {
        st.player.floorIndex += 1;
        st.player.currentRoomId = st.floors[st.player.floorIndex].startRoomId;
        st.player.discoveredRoomIds.push(st.player.currentRoomId);
        st.scene = { kind: "room", roomId: st.player.currentRoomId };
        saveState(st);
        setTimeout(() => {
          alert(`You defeated ${room.enemyIds?.[0]}! Descending to ${st.floors[st.player.floorIndex].name}.`);
          app.render();
        }, 50);
        return;
      } else {
        st.scene = { kind: "victory" };
        clearSave();
        app.render();
        return;
      }
    }
  }
  st.scene = { kind: "room", roomId };
  saveState(st);
  app.render();
}
