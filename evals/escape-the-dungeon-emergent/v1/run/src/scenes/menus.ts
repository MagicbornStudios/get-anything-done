import type { KAPLAYCtx } from "kaplay";
import { makeButton, makeText, makePanel, makeHpBar, COLORS } from "../ui";
import { getState } from "../state";
import { ContentManager } from "../content";

const TAG = "menu-ui";

export function statsScene(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state) { k.go("title"); return; }
  const p = state.player;

  makeText(k, "STATS", 400, 40, TAG, { size: 28, color: COLORS.accent });
  makePanel(k, 400, 280, 500, 400, TAG);

  const stats = [
    ["Name", p.name],
    ["Level", `${p.level}`],
    ["XP", `${p.xp} / ${p.xpToNext}`],
    ["Crystals", `${p.crystals}`],
    ["", ""],
    ["HP", `${p.stats.currentHp} / ${p.stats.maxHp}`],
    ["Mana", `${p.stats.currentMana} / ${p.stats.maxMana}`],
    ["Might", `${p.stats.might}`],
    ["Agility", `${p.stats.agility}`],
    ["Defense", `${p.stats.defense}`],
    ["Power", `${p.stats.power}`],
    ["Insight", `${p.stats.insight}`],
    ["Willpower", `${p.stats.willpower}`],
  ];

  stats.forEach(([label, value], i) => {
    if (label === "") return;
    makeText(k, `${label}:`, 220, 100 + i * 28, TAG, {
      size: 14,
      anchor: "left",
      color: COLORS.textDim,
    });
    makeText(k, value, 400, 100 + i * 28, TAG, {
      size: 14,
      anchor: "left",
      color: COLORS.text,
    });
  });

  makeButton(k, "Back", 400, 530, 150, 40, TAG, () => {
    k.go("room");
  }, COLORS.panelLight);
}

export function bagScene(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state) { k.go("title"); return; }
  const p = state.player;

  makeText(k, "BAG", 400, 40, TAG, { size: 28, color: COLORS.gold });

  if (p.inventory.length === 0) {
    makeText(k, "Your bag is empty.", 400, 200, TAG, { size: 16, color: COLORS.textDim });
  }

  p.inventory.forEach((inv, i) => {
    const item = ContentManager.getItem(inv.itemId);
    if (!item) return;

    makeText(k, `${item.name} x${inv.quantity}`, 250, 100 + i * 35, TAG, {
      size: 15,
      anchor: "left",
      color: COLORS.text,
    });
    makeText(k, item.description, 480, 100 + i * 35, TAG, {
      size: 13,
      anchor: "left",
      color: COLORS.textDim,
    });
  });

  makeButton(k, "Back", 400, 530, 150, 40, TAG, () => {
    k.go("room");
  }, COLORS.panelLight);
}

export function spellbookScene(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state) { k.go("title"); return; }
  const p = state.player;

  makeText(k, "SPELLBOOK", 400, 40, TAG, { size: 28, color: COLORS.mana });

  p.spells.forEach((spellId, i) => {
    const spell = ContentManager.getSpell(spellId);
    if (!spell) return;

    makePanel(k, 400, 110 + i * 70, 600, 55, TAG, COLORS.panelLight);

    makeText(k, spell.name, 150, 100 + i * 70, TAG, {
      size: 16,
      anchor: "left",
      color: COLORS.mana,
    });
    makeText(k, `Cost: ${spell.manaCost} MP`, 350, 100 + i * 70, TAG, {
      size: 13,
      anchor: "left",
      color: COLORS.textDim,
    });
    makeText(k, spell.description, 150, 120 + i * 70, TAG, {
      size: 12,
      anchor: "left",
      color: COLORS.text,
    });
    makeText(k, `Runes: ${spell.runes.join("-")}`, 500, 100 + i * 70, TAG, {
      size: 12,
      anchor: "left",
      color: COLORS.textDim,
    });
  });

  makeButton(k, "Back", 400, 530, 150, 40, TAG, () => {
    k.go("room");
  }, COLORS.panelLight);
}

export function mapScene(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state) { k.go("title"); return; }
  const p = state.player;

  const floor = ContentManager.getFloor(p.currentFloorId);
  if (!floor) { k.go("room"); return; }

  makeText(k, `MAP - ${floor.name}`, 400, 40, TAG, { size: 24, color: COLORS.accent });

  const featureIcons: Record<string, string> = {
    start: "S",
    combat: "!",
    boss: "B",
    dialogue: "?",
    treasure: "$",
    rest: "+",
  };

  const featureColors: Record<string, [number, number, number]> = {
    start: COLORS.textDim,
    combat: COLORS.danger,
    boss: COLORS.danger,
    dialogue: COLORS.accent,
    treasure: COLORS.gold,
    rest: COLORS.success,
  };

  // Simple list layout for rooms
  floor.rooms.forEach((room, i) => {
    const discovered = p.discoveredRooms.includes(room.id);
    const isCurrent = room.id === p.currentRoomId;

    const icon = featureIcons[room.feature] ?? "?";
    const col = isCurrent
      ? COLORS.success
      : discovered
      ? (featureColors[room.feature] ?? COLORS.textDim)
      : [80, 80, 80] as [number, number, number];

    const name = discovered ? room.name : "???";
    const prefix = isCurrent ? "> " : "  ";

    makeText(k, `${prefix}[${icon}] ${name}`, 200, 90 + i * 35, TAG, {
      size: 14,
      anchor: "left",
      color: col,
    });

    if (discovered && room.exits.length > 0) {
      const exitStr = room.exits.map((e) => e.direction).join(", ");
      makeText(k, `Exits: ${exitStr}`, 550, 90 + i * 35, TAG, {
        size: 12,
        anchor: "left",
        color: COLORS.textDim,
      });
    }
  });

  makeButton(k, "Back", 400, 530, 150, 40, TAG, () => {
    k.go("room");
  }, COLORS.panelLight);
}
