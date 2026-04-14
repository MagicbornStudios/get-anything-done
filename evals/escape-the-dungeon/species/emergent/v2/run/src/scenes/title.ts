// Title scene — entry point
// Skill: kaplay-scene-pattern (re-render with destroyAll)

import type { KAPLAYCtx } from "kaplay";
import { COLORS, addButton, addPanel, addTitle, addLabel } from "../ui";
import { hasSavedGame, loadGame, deleteSave, createNewPlayer, createGameState } from "../state";
import type { GameState } from "../types";

const TAG = "title-ui";

export function registerTitleScene(k: KAPLAYCtx): void {
  k.scene("title", () => {
    render(k);
  });
}

function render(k: KAPLAYCtx): void {
  k.destroyAll(TAG);

  const cx = k.width() / 2;
  const cy = k.height() / 2;

  // Background panel
  addPanel(k, cx, cy, 500, 420, TAG, {
    color: [20, 20, 32],
    borderColor: COLORS.accent,
  });

  // Title
  addTitle(k, "ESCAPE THE DUNGEON", cx, cy - 140, TAG, {
    size: 36,
    color: COLORS.gold,
  });

  // Subtitle
  addLabel(k, "A Roguelike Dungeon Crawler", cx, cy - 95, TAG, {
    size: 16,
    color: COLORS.textDim,
    anchor: "center",
  });

  // Decorative line
  k.add([
    k.rect(300, 2),
    k.pos(cx, cy - 70),
    k.anchor("center"),
    k.color(k.rgb(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2])),
    k.opacity(0.5),
    TAG,
  ]);

  // New Game button
  addButton(k, "New Game", cx, cy - 20, {
    tag: TAG,
    width: 260,
    height: 50,
    color: COLORS.accent,
    fontSize: 22,
    onClick: () => {
      k.go("charSelect", {});
    },
  });

  // Continue button (if save exists)
  if (hasSavedGame()) {
    addButton(k, "Continue", cx, cy + 45, {
      tag: TAG,
      width: 260,
      height: 50,
      color: [60, 130, 80],
      onClick: () => {
        const state = loadGame();
        if (state) {
          k.go("room", { gameState: state });
        }
      },
    });

    addButton(k, "Delete Save", cx, cy + 105, {
      tag: TAG,
      width: 180,
      height: 36,
      color: COLORS.danger,
      fontSize: 14,
      onClick: () => {
        deleteSave();
        render(k);
      },
    });
  }

  // Footer
  addLabel(k, "v1.0 - Built with KAPLAY", cx, cy + 170, TAG, {
    size: 12,
    color: COLORS.textDim,
    anchor: "center",
  });
}

// Character select scene
export function registerCharSelectScene(k: KAPLAYCtx): void {
  k.scene("charSelect", () => {
    renderCharSelect(k);
  });
}

function renderCharSelect(k: KAPLAYCtx): void {
  k.destroyAll("cs-ui");

  const cx = k.width() / 2;
  const cy = k.height() / 2;

  addPanel(k, cx, cy, 600, 440, "cs-ui", {
    color: [20, 20, 32],
    borderColor: COLORS.accent,
  });

  addTitle(k, "Choose Your Path", cx, cy - 160, "cs-ui", {
    size: 30,
    color: COLORS.gold,
  });

  const archetypes = [
    { id: "wanderer", name: "Wanderer", desc: "Balanced stats. Jack of all trades.", color: [100, 160, 100] as const },
    { id: "warrior", name: "Warrior", desc: "High HP and Might. Low agility.", color: [180, 80, 80] as const },
    { id: "mage", name: "Mage", desc: "High Mana and Power. Fragile.", color: [80, 100, 200] as const },
  ];

  archetypes.forEach((arch, i) => {
    const y = cy - 70 + i * 100;

    // Archetype panel
    addPanel(k, cx, y, 460, 80, "cs-ui", {
      color: [30, 30, 48],
      borderColor: arch.color as unknown as readonly [number, number, number],
    });

    addLabel(k, arch.name, cx - 160, y - 14, "cs-ui", {
      size: 22,
      color: arch.color as unknown as readonly [number, number, number],
    });

    addLabel(k, arch.desc, cx - 160, y + 12, "cs-ui", {
      size: 14,
      color: COLORS.textDim,
    });

    addButton(k, "Select", cx + 160, y, {
      tag: "cs-ui",
      width: 100,
      height: 40,
      color: arch.color as unknown as readonly [number, number, number],
      onClick: () => {
        startNewGame(k, arch.id);
      },
    });
  });

  addButton(k, "Back", cx, cy + 180, {
    tag: "cs-ui",
    width: 140,
    height: 36,
    color: COLORS.textDim,
    fontSize: 16,
    onClick: () => {
      k.go("title", {});
    },
  });
}

function startNewGame(k: KAPLAYCtx, archetypeId: string): void {
  const player = createNewPlayer(archetypeId);
  const gameState: GameState = createGameState(player);
  k.go("room", { gameState });
}
