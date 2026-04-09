import type { KAPLAYCtx } from "kaplay";
import { getState } from "./gameState";
import { getIconSvg, GAME_ICONS } from "./icons";
import type { RoomType } from "../types/game";

// Color palette
export const COLORS = {
  bg: "#0f0f23",
  panel: "#1a1a3e",
  panelBorder: "#333366",
  gold: "#ffd700",
  text: "#e0e0e0",
  textDim: "#808090",
  hpBar: "#cc3333",
  hpBarBg: "#441111",
  manaBar: "#3366cc",
  manaBarBg: "#111144",
  xpBar: "#cccc33",
  buttonBg: "#2a2a4a",
  buttonHover: "#3a3a5a",
  buttonBorder: "#4a4a6a",
  success: "#44cc44",
  danger: "#cc4444",
  warning: "#ccaa44",
};

export const ROOM_COLORS: Record<RoomType, { bg: string; border: string; text: string; icon: string }> = {
  combat: { bg: "#2a1111", border: "#663333", text: "#ff6666", icon: GAME_ICONS.combat },
  elite: { bg: "#2a1a00", border: "#664400", text: "#ff8800", icon: GAME_ICONS.elite },
  forge: { bg: "#0a1a2a", border: "#336688", text: "#66aaff", icon: GAME_ICONS.forge },
  rest: { bg: "#0a2a0a", border: "#336633", text: "#66ff66", icon: GAME_ICONS.rest },
  event: { bg: "#1a1a2a", border: "#444466", text: "#aaaaff", icon: GAME_ICONS.event },
  boss: { bg: "#2a0a2a", border: "#662266", text: "#ff66ff", icon: GAME_ICONS.boss },
  dialogue: { bg: "#1a1a0a", border: "#444433", text: "#cccc66", icon: GAME_ICONS.dialogue },
  treasure: { bg: "#2a2a00", border: "#666600", text: "#ffff66", icon: GAME_ICONS.treasure },
  start: { bg: "#0a1a1a", border: "#336666", text: "#66ffff", icon: GAME_ICONS.start },
};

/** Draw the persistent HUD bar at the top of screen */
export function drawHUD(k: KAPLAYCtx) {
  const state = getState();
  const p = state.player;
  const hudH = 44;

  // HUD background
  k.add([k.rect(k.width(), hudH), k.color(k.Color.fromHex(COLORS.panel)), k.pos(0, 0), k.z(100)]);
  k.add([k.rect(k.width(), 2), k.color(k.Color.fromHex(COLORS.panelBorder)), k.pos(0, hudH), k.z(100)]);

  // Player name + level
  k.add([k.text(`Lv.${p.level} ${p.name}`, { size: 14 }), k.pos(10, 6), k.color(k.Color.fromHex(COLORS.gold)), k.z(101)]);

  // HP bar
  drawBar(k, 10, 24, 120, 14, p.combatStats.currentHp, p.combatStats.maxHp, COLORS.hpBar, COLORS.hpBarBg, `HP ${p.combatStats.currentHp}/${p.combatStats.maxHp}`);

  // Mana bar
  drawBar(k, 140, 24, 120, 14, p.combatStats.currentMana, p.combatStats.maxMana, COLORS.manaBar, COLORS.manaBarBg, `MP ${p.combatStats.currentMana}/${p.combatStats.maxMana}`);

  // Floor + Tick
  k.add([k.text(`Floor ${p.currentFloor}`, { size: 12 }), k.pos(280, 8), k.color(k.Color.fromHex(COLORS.text)), k.z(101)]);
  k.add([k.text(`Tick ${p.tick}`, { size: 12 }), k.pos(280, 26), k.color(k.Color.fromHex(COLORS.textDim)), k.z(101)]);

  // Crystals
  k.add([k.text(`Crystals: ${p.crystals}`, { size: 12 }), k.pos(360, 8), k.color(k.Color.fromHex("#aaddff")), k.z(101)]);

  // XP
  k.add([k.text(`XP: ${p.xp}/${p.xpToNext}`, { size: 12 }), k.pos(360, 26), k.color(k.Color.fromHex(COLORS.xpBar)), k.z(101)]);

  // Menu buttons (right side)
  const menuItems = [
    { label: "Map", key: "m" },
    { label: "Bag", key: "b" },
    { label: "Spells", key: "s" },
    { label: "Traits", key: "t" },
  ];

  menuItems.forEach((item, i) => {
    const x = k.width() - 280 + i * 70;
    const btn = k.add([
      k.rect(64, 30, { radius: 4 }),
      k.color(k.Color.fromHex(COLORS.buttonBg)),
      k.outline(1, k.Color.fromHex(COLORS.buttonBorder)),
      k.pos(x, 7),
      k.area(),
      k.z(101),
    ]);
    k.add([k.text(item.label, { size: 11 }), k.pos(x + 32, 22), k.anchor("center"), k.color(k.Color.fromHex(COLORS.text)), k.z(102)]);

    btn.onClick(() => {
      // Overlay menus handled via state toggle
      showOverlay(k, item.label.toLowerCase() as "map" | "bag" | "spells" | "traits");
    });
  });
}

function drawBar(k: KAPLAYCtx, x: number, y: number, w: number, h: number, current: number, max: number, fgColor: string, bgColor: string, label: string) {
  k.add([k.rect(w, h, { radius: 3 }), k.color(k.Color.fromHex(bgColor)), k.pos(x, y), k.z(101)]);
  const fillW = Math.max(1, (current / max) * w);
  k.add([k.rect(fillW, h, { radius: 3 }), k.color(k.Color.fromHex(fgColor)), k.pos(x, y), k.z(101)]);
  k.add([k.text(label, { size: 10 }), k.pos(x + w / 2, y + h / 2), k.anchor("center"), k.color(255, 255, 255), k.z(102)]);
}

// Overlay system
let overlayActive = false;

export function showOverlay(k: KAPLAYCtx, type: "map" | "bag" | "spells" | "traits") {
  if (overlayActive) return;
  overlayActive = true;
  const state = getState();
  const p = state.player;

  // Overlay background
  const overlay = k.add([
    k.rect(k.width() - 100, k.height() - 100, { radius: 8 }),
    k.color(k.Color.fromHex("#111133")),
    k.outline(2, k.Color.fromHex(COLORS.gold)),
    k.pos(50, 50),
    k.z(200),
    "overlay",
  ]);

  // Close button
  const closeBtn = k.add([
    k.rect(80, 32, { radius: 4 }),
    k.color(k.Color.fromHex(COLORS.danger)),
    k.pos(k.width() - 100, 58),
    k.anchor("topright"),
    k.area(),
    k.z(201),
    "overlay",
  ]);
  k.add([k.text("Close [X]", { size: 12 }), k.pos(k.width() - 100 - 40, 74), k.anchor("center"), k.color(255, 255, 255), k.z(202), "overlay"]);

  const titleText = type.charAt(0).toUpperCase() + type.slice(1);
  k.add([k.text(titleText, { size: 24 }), k.pos(k.width() / 2, 80), k.anchor("center"), k.color(k.Color.fromHex(COLORS.gold)), k.z(201), "overlay"]);

  const contentY = 120;

  if (type === "bag") {
    if (p.items.length === 0) {
      k.add([k.text("Your bag is empty.", { size: 16 }), k.pos(80, contentY), k.color(k.Color.fromHex(COLORS.textDim)), k.z(201), "overlay"]);
    } else {
      p.items.forEach((item, i) => {
        k.add([k.text(`${item.name} - ${item.description}`, { size: 14 }), k.pos(80, contentY + i * 28), k.color(k.Color.fromHex(COLORS.text)), k.z(201), "overlay"]);
      });
    }
  } else if (type === "spells") {
    if (p.spells.length === 0) {
      k.add([k.text("No spells learned.", { size: 16 }), k.pos(80, contentY), k.color(k.Color.fromHex(COLORS.textDim)), k.z(201), "overlay"]);
    } else {
      p.spells.forEach((spell, i) => {
        const craftLabel = spell.crafted ? " [Crafted]" : "";
        k.add([k.text(`${spell.name}${craftLabel} - ${spell.description} (${spell.manaCost} MP, ${spell.damage} ${spell.damageType} dmg)`, { size: 13 }), k.pos(80, contentY + i * 28), k.color(k.Color.fromHex(COLORS.text)), k.z(201), "overlay"]);
      });
    }
  } else if (type === "traits") {
    const traits = p.narrativeStats;
    const traitNames = Object.keys(traits) as (keyof typeof traits)[];
    traitNames.forEach((name, i) => {
      const col = i < 8 ? 0 : 1;
      const row = i < 8 ? i : i - 8;
      const x = 80 + col * 350;
      const y = contentY + row * 28;
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      k.add([k.text(`${label}: ${traits[name]}`, { size: 14 }), k.pos(x, y), k.color(k.Color.fromHex(COLORS.text)), k.z(201), "overlay"]);
    });
  } else if (type === "map") {
    const floor = state.floors.find(f => f.id === p.currentFloor);
    if (floor) {
      floor.rooms.forEach((room, i) => {
        const discovered = p.discoveredRooms.includes(room.id);
        const isCurrent = room.id === p.currentRoom;
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 80 + col * 200;
        const y = contentY + row * 80;

        if (discovered) {
          const rc = ROOM_COLORS[room.type];
          const bgCol = isCurrent ? "#333366" : rc.bg;
          k.add([k.rect(180, 60, { radius: 4 }), k.color(k.Color.fromHex(bgCol)), k.outline(isCurrent ? 2 : 1, k.Color.fromHex(isCurrent ? COLORS.gold : rc.border)), k.pos(x, y), k.z(201), "overlay"]);
          k.add([k.text(room.name, { size: 12 }), k.pos(x + 90, y + 15), k.anchor("center"), k.color(k.Color.fromHex(rc.text)), k.z(202), "overlay"]);
          k.add([k.text(`[${room.type}]${room.cleared ? " ✓" : ""}`, { size: 10 }), k.pos(x + 90, y + 38), k.anchor("center"), k.color(k.Color.fromHex(COLORS.textDim)), k.z(202), "overlay"]);
        } else {
          k.add([k.rect(180, 60, { radius: 4 }), k.color(k.Color.fromHex("#111111")), k.outline(1, k.Color.fromHex("#222222")), k.pos(x, y), k.z(201), "overlay"]);
          k.add([k.text("???", { size: 16 }), k.pos(x + 90, y + 30), k.anchor("center"), k.color(k.Color.fromHex("#333333")), k.z(202), "overlay"]);
        }
      });
    }
  }

  const closeOverlay = () => {
    k.get("overlay").forEach(obj => k.destroy(obj));
    overlayActive = false;
  };

  closeBtn.onClick(closeOverlay);
  k.onKeyPress("x", closeOverlay);
  k.onKeyPress("escape", closeOverlay);
}

export function isOverlayActive(): boolean {
  return overlayActive;
}

/** Get an icon data URL for a room type */
export function getRoomIcon(roomType: RoomType, size = 48): string {
  const rc = ROOM_COLORS[roomType];
  return getIconSvg(rc.icon, rc.text, size);
}
