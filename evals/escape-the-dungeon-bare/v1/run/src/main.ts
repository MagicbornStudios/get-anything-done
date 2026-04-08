import kaplay from "kaplay";
import { content } from "./systems/content";
import { setupTitleScene } from "./scenes/title";
import { setupGameScene } from "./scenes/game";
import { setupCombatScene } from "./scenes/combat";
import { setupDialogueScene } from "./scenes/dialogue";
import { setupGameOverScene } from "./scenes/gameover";
import { setupVictoryScene } from "./scenes/victory";

async function main() {
  // Initialize KAPLAY
  const k = kaplay({
    width: 800,
    height: 600,
    background: [20, 20, 30],
    canvas: document.createElement("canvas"),
    global: false,
    crisp: true,
  });

  document.body.appendChild(k.canvas);

  // Load content packs
  await content.load();

  // Register all scenes
  setupTitleScene(k);
  setupGameScene(k);
  setupCombatScene(k);
  setupDialogueScene(k);
  setupGameOverScene(k);
  setupVictoryScene(k);

  // Start at title screen
  k.go("title");
}

main().catch((err) => {
  console.error("Game failed to start:", err);
  // Show error on screen as fallback
  const div = document.createElement("div");
  div.style.cssText = "color:white;font-size:24px;padding:40px;font-family:monospace;";
  div.textContent = `Error: ${err.message}`;
  document.body.appendChild(div);
});
