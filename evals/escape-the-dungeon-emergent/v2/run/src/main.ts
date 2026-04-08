// Main entry point — Escape the Dungeon
// Loads content, initializes KAPLAY, registers all scenes

import kaplay from "kaplay";
import { loadContent } from "./content";
import { registerTitleScene, registerCharSelectScene } from "./scenes/title";
import { registerRoomScene } from "./scenes/room";
import { registerCombatScene } from "./scenes/combat";
import { registerDialogueScene } from "./scenes/dialogue";
import { registerForgeScene } from "./scenes/forge";
import { registerBagScene } from "./scenes/bag";
import { registerSpellbookScene } from "./scenes/spellbook";
import { registerMapScene } from "./scenes/map";

async function main() {
  // Load content packs first
  await loadContent();

  // Initialize KAPLAY — let it manage its own canvas
  const k = kaplay({
    width: 800,
    height: 640,
    background: [16, 16, 24],
    global: false,
  });

  // Register all scenes
  registerTitleScene(k);
  registerCharSelectScene(k);
  registerRoomScene(k);
  registerCombatScene(k);
  registerDialogueScene(k);
  registerForgeScene(k);
  registerBagScene(k);
  registerSpellbookScene(k);
  registerMapScene(k);

  // Start at title screen
  k.go("title", {});
}

main().catch((err) => {
  console.error("Failed to start game:", err);
  document.body.innerHTML = `<div style="color: white; padding: 40px; font-family: monospace;">
    <h1>Failed to start</h1>
    <p>${err.message}</p>
  </div>`;
});
