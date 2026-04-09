import type { GameState } from "./state";
import { getCurrentFloor, getCurrentRoom } from "./state";
import { ITEMS } from "./data/items";
import { ROOM_ICONS, ROOM_COLORS, type RoomType } from "./data/floors";

// Update HUD
export function updateHUD(state: GameState): void {
  const hud = document.getElementById("hud")!;
  hud.classList.add("visible");
  document.getElementById("menu-bar")!.classList.add("visible");

  document.getElementById("hud-name")!.textContent = `${state.playerName} Lv.${state.level}`;

  const hpPct = (state.stats.currentHp / state.stats.maxHp) * 100;
  const manaPct = (state.stats.currentMana / state.stats.maxMana) * 100;

  (document.getElementById("hud-hp-bar") as HTMLElement).style.width = `${hpPct}%`;
  document.getElementById("hud-hp-text")!.textContent = `${state.stats.currentHp}/${state.stats.maxHp}`;

  (document.getElementById("hud-mana-bar") as HTMLElement).style.width = `${manaPct}%`;
  document.getElementById("hud-mana-text")!.textContent = `${state.stats.currentMana}/${state.stats.maxMana}`;

  document.getElementById("hud-crystals")!.textContent = String(state.crystals);
  document.getElementById("hud-floor")!.textContent = String(state.currentFloor);
  document.getElementById("hud-tick")!.textContent = String(state.dungeonTick);
}

export function hideHUD(): void {
  document.getElementById("hud")!.classList.remove("visible");
  document.getElementById("menu-bar")!.classList.remove("visible");
}

// Screen management
export function showScreen(screenId: string): void {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId)?.classList.add("active");
}

// Overlay management
export function openOverlay(name: string, state: GameState): void {
  closeAllOverlays();
  const overlay = document.getElementById(`overlay-${name}`);
  if (!overlay) return;
  overlay.classList.add("active");

  if (name === "map") renderMapOverlay(state);
  if (name === "bag") renderBagOverlay(state);
  if (name === "stats") renderStatsOverlay(state);
  if (name === "spellbook") renderSpellbookOverlay(state);
}

export function closeAllOverlays(): void {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.remove("active"));
}

// Render map overlay
function renderMapOverlay(state: GameState): void {
  const container = document.getElementById("map-content")!;
  const floor = getCurrentFloor(state);

  let html = `<p style="text-align:center;color:#8a7a9a;margin-bottom:12px">${floor.name} — ${floor.description}</p>`;
  html += `<p style="text-align:center;color:#ffaa44;margin-bottom:16px;font-size:13px">⚠️ ${floor.mechanicalConstraint}</p>`;
  html += `<div class="map-grid">`;

  // Simple list-based map
  for (const room of floor.rooms) {
    const isCurrent = room.id === state.currentRoomId;
    const isVisited = state.visitedRooms.has(room.id);
    const isCleared = state.clearedRooms.has(room.id);
    const isAdjacent = getCurrentRoom(state).exits.some((e) => e.targetId === room.id);
    const visible = isVisited || isAdjacent || room.type === "boss";

    const classes = ["map-cell"];
    if (isCurrent) classes.push("current");
    if (isVisited) classes.push("visited");
    if (!visible) classes.push("hidden");

    html += `<div class="${classes.join(" ")}" style="width:auto;padding:8px 16px;flex-direction:row;gap:8px;border-color:${ROOM_COLORS[room.type]}">`;
    html += `<span class="map-cell-icon">${ROOM_ICONS[room.type]}</span>`;
    html += `<span style="font-size:12px">${visible ? room.name : "???"}</span>`;
    if (isCurrent) html += `<span style="color:#ffd700;font-size:10px">(HERE)</span>`;
    if (isCleared) html += `<span style="color:#44aa44;font-size:10px">✓</span>`;
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// Render bag overlay
function renderBagOverlay(state: GameState): void {
  const container = document.getElementById("bag-content")!;

  if (state.inventory.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#8a7a9a">Your bag is empty.</p>`;
    return;
  }

  let html = "";
  for (const inv of state.inventory) {
    const item = ITEMS[inv.itemId];
    if (!item) continue;
    html += `<div class="item-row">`;
    html += `<span class="item-icon">${item.icon}</span>`;
    html += `<div class="item-info"><div class="item-name">${item.name}</div><div class="item-desc">${item.description}</div></div>`;
    html += `<span class="item-count">x${inv.count}</span>`;
    html += `</div>`;
  }
  container.innerHTML = html;
}

// Render stats overlay
function renderStatsOverlay(state: GameState): void {
  const container = document.getElementById("stats-content")!;

  let html = `<h3 style="color:#ffd700;margin-bottom:12px">Combat Stats</h3>`;
  html += `<div class="stat-grid">`;
  html += statRow("Level", String(state.level));
  html += statRow("XP", `${state.xp}/${state.xpToLevel}`);
  html += statRow("HP", `${state.stats.currentHp}/${state.stats.maxHp}`);
  html += statRow("Mana", `${state.stats.currentMana}/${state.stats.maxMana}`);
  html += statRow("Might", String(state.stats.might));
  html += statRow("Agility", String(state.stats.agility));
  html += statRow("Defense", String(state.stats.defense));
  html += statRow("Power", String(state.stats.power));
  html += statRow("Insight", String(state.stats.insight));
  html += statRow("Willpower", String(state.stats.willpower));
  html += statRow("Crystals", String(state.crystals));
  html += `</div>`;

  html += `<h3 style="color:#ffd700;margin:20px 0 12px">Traits</h3>`;
  html += `<div class="stat-grid">`;
  for (const [key, val] of Object.entries(state.narrativeStats)) {
    html += statRow(key, String(val));
  }
  html += `</div>`;

  if (Object.keys(state.runeAffinity).length > 0) {
    html += `<h3 style="color:#ffd700;margin:20px 0 12px">Rune Affinity</h3>`;
    html += `<div class="affinity-grid">`;
    for (const [runeId, level] of Object.entries(state.runeAffinity)) {
      const name = runeId.replace("rune_", "").charAt(0).toUpperCase() + runeId.replace("rune_", "").slice(1);
      const pct = Math.min(100, (level / 5) * 100);
      html += `<div class="affinity-item">`;
      html += `<div>${name}: ${level.toFixed(1)}</div>`;
      html += `<div class="affinity-bar"><div class="affinity-fill" style="width:${pct}%"></div></div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
}

function statRow(label: string, value: string): string {
  return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}

// Render spellbook overlay
function renderSpellbookOverlay(state: GameState): void {
  const container = document.getElementById("spellbook-content")!;

  if (state.spells.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#8a7a9a">No spells learned.</p>`;
    return;
  }

  let html = "";
  for (const spell of state.spells) {
    const classes = ["spell-row"];
    if (spell.crafted) classes.push("spell-crafted");
    html += `<div class="${classes.join(" ")}">`;
    html += `<span class="spell-icon-big">${spell.icon}</span>`;
    html += `<div class="spell-detail">`;
    html += `<div class="spell-detail-name">${spell.name}${spell.crafted ? " ⚒️" : ""}</div>`;
    html += `<div class="spell-detail-info">Mana: ${spell.manaCost} | ${spell.description}</div>`;
    html += `<div class="spell-detail-info">${spell.effects.map((e) => e.description).join(", ")}</div>`;
    html += `</div>`;
    html += `</div>`;
  }
  container.innerHTML = html;
}

// Render resistance badges
export function renderResistanceBadges(resistances: { element: string; value: number }[]): string {
  return resistances
    .map((r) => {
      const label = r.value > 0 ? `Resist ${r.element}` : `Weak ${r.element}`;
      const cls = `resist-badge resist-${r.element}`;
      return `<span class="${cls}">${r.value > 0 ? "🛡️" : "⚡"} ${label} (${Math.round(Math.abs(r.value) * 100)}%)</span>`;
    })
    .join(" ");
}

// Build an HP bar HTML string
export function renderHPBar(current: number, max: number, color: "hp" | "mana" = "hp"): string {
  const pct = Math.max(0, (current / max) * 100);
  return `<div class="bar-container" style="width:180px">
    <div class="bar-fill ${color}-fill" style="width:${pct}%"></div>
    <div class="bar-text">${current}/${max}</div>
  </div>`;
}
